"use strict";

import { In } from "typeorm";
import {
  createSubscription as createPayPalSubscription,
  createCatalogProduct,
  createBillingPlan,
  getBillingPlan,
  getSubscription as getPayPalSubscription,
  cancelSubscription as cancelPayPalSubscription,
  listAllSubscriptionTransactions,
  buildDeterministicPayPalRequestId,
} from "../paypal/paypalSubscription.service.js";
import {
  AppDataSource,
  Animal,
  ensurePositiveAmount,
  FileAsset,
  PaymentProvider,
  Sponsor,
  Sponsorship,
  SponsorshipPlan,
  Subscription,
  SubscriptionPayment,
  Transaction,
  buildPublicFilePreviewUrl,
  buildServiceError,
  createPublicReference,
  getPaymentProviderByKeyOrThrow,
  getTransactionCategoryByKeyOrThrow,
  isPublicAnimalEligible,
  isUniqueConstraintError,
  loadPublicAnimalMediaMap,
  mapAdminSubscription,
  mapAdminSubscriptionPayment,
  mapAdminSponsorshipPlan,
  normalizeNullableString,
  normalizeSponsorEmail,
  toIsoTimestamp,
  toNumericNumber,
} from "./sponsorship.shared.js";
import { mapTransaction } from "./accounting.shared.js";
import { PayPalApiError } from "../paypal/paypal.service.js";
import {
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../../entities/file_asset.entity.js";

const PAYPAL_PROVIDER_KEY = "PAYPAL";
const MANUAL_PROVIDER_KEY = "MANUAL";
const APADRINAMIENTO_CATEGORY_KEY = "APADRINAMIENTO";
const DONATION_REFUND_CATEGORY_KEY = "DEVOLUCION_DONACION";
const PAYPAL_REVERSAL_CATEGORY_KEY = "REVERSA_PAYPAL";
const ACTIVE_SPONSORSHIP_STATES = new Set([
  "PENDIENTE_APROBACION",
  "ACTIVO",
  "SUSPENDIDO",
]);
const SUBSCRIPTION_TERMINAL_STATES = new Set(["CANCELADA", "EXPIRADA"]);
const SUBSCRIPTION_APPROVAL_PENDING_PROVIDER_STATES = new Set([
  "APPROVAL_PENDING",
  "APPROVED",
]);
const DEFAULT_SYNC_LOOKBACK_DAYS = 90;
const SAFE_SYNC_OVERLAP_DAYS = 7;

function normalizeString(value) {
  return normalizeNullableString(value);
}

function normalizeText(value, fallback = null) {
  const normalized = normalizeString(value);
  return normalized ? normalized.replace(/\s+/g, " ") : fallback;
}

function normalizeCurrency(value) {
  return String(value || "USD").trim().toUpperCase();
}

export function addOneCalendarMonth(dateLike) {
  const source = new Date(dateLike);
  if (Number.isNaN(source.getTime())) {
    throw buildServiceError("La fecha indicada no es valida.", 400);
  }

  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();

  return new Date(Date.UTC(
    year,
    month + 1,
    Math.min(day, lastDayOfTargetMonth),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
}

function normalizeAdminIdempotencyKey(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw buildServiceError("Debes enviar el header Idempotency-Key.", 400);
  }

  return normalized.toLowerCase();
}

function buildPublicStartError(message, statusCode = 400) {
  return { message, statusCode, publicSafe: true };
}

function normalizePublicError(error, fallbackMessage) {
  if (error?.publicSafe && error?.message) {
    return error;
  }

  if (error?.statusCode && error?.message) {
    return buildServiceError(error.message, error.statusCode);
  }

  return buildServiceError(fallbackMessage, 500);
}

function isDefinitivePayPalError(error) {
  return error instanceof PayPalApiError
    && Number(error.statusCode) >= 400
    && Number(error.statusCode) < 500;
}

function isTimeoutOrUncertainPayPalError(error) {
  return error instanceof PayPalApiError
    && (
      error.code === "PAYPAL_REQUEST_TIMEOUT"
      || Number(error.statusCode) >= 500
    );
}

function normalizePublicIdempotencyKey(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw buildPublicStartError("Debes enviar el header Idempotency-Key.", 400);
  }

  return normalized.toLowerCase();
}

function normalizePublicSponsorPayload(body = {}) {
  return {
    nombre: normalizeText(body.nombre),
    apellido: normalizeText(body.apellido),
    email: normalizeSponsorEmail(body.email),
    telefono: normalizeText(body.telefono),
  };
}

function sanitizeSubscriptionMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null || value === "") continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeSubscriptionMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function mergeSubscriptionMetadata(subscription, patch = {}) {
  const current = sanitizeSubscriptionMetadata(subscription?.metadata || {}) || {};
  const next = sanitizeSubscriptionMetadata({
    ...current,
    ...patch,
  });
  return next;
}

export function mapPayPalSubscriptionStatusToLocal(providerStatus) {
  const normalized = String(providerStatus || "").trim().toUpperCase();

  if (!normalized) return null;
  if (SUBSCRIPTION_APPROVAL_PENDING_PROVIDER_STATES.has(normalized)) {
    return "APROBACION_PENDIENTE";
  }

  switch (normalized) {
    case "ACTIVE":
      return "ACTIVA";
    case "SUSPENDED":
      return "SUSPENDIDA";
    case "CANCELLED":
      return "CANCELADA";
    case "EXPIRED":
      return "EXPIRADA";
    case "CREATED":
      return "CREADA";
    default:
      return null;
  }
}

export function mapSubscriptionStateToSponsorshipState(subscriptionState) {
  switch (subscriptionState) {
    case "ACTIVA":
      return "ACTIVO";
    case "SUSPENDIDA":
      return "SUSPENDIDO";
    case "CANCELADA":
    case "EXPIRADA":
      return "CANCELADO";
    default:
      return null;
  }
}

function shouldIgnoreProviderStateTransition(subscription, nextState, providerTimestamp) {
  if (!nextState) return false;
  if (!SUBSCRIPTION_TERMINAL_STATES.has(subscription?.estado)) return false;
  if (SUBSCRIPTION_TERMINAL_STATES.has(nextState)) return false;
  if (!subscription?.provider_status_updated_at || !providerTimestamp) return false;

  return new Date(providerTimestamp).getTime()
    < new Date(subscription.provider_status_updated_at).getTime();
}

function buildProvisionDto(plan, paypalStatus = null) {
  return mapAdminSponsorshipPlan(plan, {
    hasHistory: Array.isArray(plan?.sponsorships) && plan.sponsorships.length > 0,
    paypalStatus,
  });
}

function buildPublicSponsorshipStartDto(sponsorship, subscription) {
  return {
    public_reference: sponsorship.public_reference,
    approval_url: subscription.approval_url,
  };
}

async function loadAnimalMainImage(manager, animalId) {
  const mediaMap = await loadPublicAnimalMediaMap(manager, [Number(animalId)]);
  return mediaMap.get(Number(animalId))?.main || null;
}

function buildPublicSponsorshipStatusDto(sponsorship, subscription, mainImage = null) {
  return {
    public_reference: sponsorship.public_reference,
    estado_apadrinamiento: sponsorship.estado,
    estado_suscripcion: subscription.estado,
    animal: sponsorship.animal
      ? {
          id: Number(sponsorship.animal.id_animal),
          nombre: sponsorship.animal.nombre || "",
          imagen_principal: buildPublicFilePreviewUrl(mainImage?.public_id),
        }
      : null,
    plan: sponsorship.plan
      ? {
          nombre: sponsorship.plan.nombre || "",
          monto: toNumericNumber(sponsorship.plan.monto),
          moneda: sponsorship.plan.moneda || "USD",
        }
      : null,
  };
}

async function lockRowIfPossible(repository, alias, idField, idValue) {
  if (typeof repository.createQueryBuilder !== "function") {
    return repository.findOne({ where: { [idField]: Number(idValue) } });
  }

  return repository
    .createQueryBuilder(alias)
    .setLock("pessimistic_write")
    .where(`${alias}.${idField} = :id`, { id: Number(idValue) })
    .getOne();
}

async function loadPlanWithRelations(repository, planId) {
  return repository.findOne({
    where: { sponsorship_plan_id: Number(planId) },
    relations: {
      sponsorships: true,
    },
  });
}

async function loadSubscriptionWithRelations(repository, subscriptionId) {
  return repository.findOne({
    where: { subscription_id: Number(subscriptionId) },
    relations: {
      sponsorship: {
        sponsor: true,
        animal: true,
        plan: true,
      },
      payment_provider: true,
      payments: {
        transaction: true,
      },
    },
  });
}

async function loadSubscriptionByProviderId(repository, providerSubscriptionId) {
  return repository.findOne({
    where: { provider_subscription_id: providerSubscriptionId },
    relations: {
      sponsorship: {
        sponsor: true,
        animal: true,
        plan: true,
      },
      payment_provider: true,
      payments: {
        transaction: true,
      },
    },
  });
}

async function loadSubscriptionPaymentWithRelations(repository, subscriptionPaymentId) {
  return repository.findOne({
    where: { subscription_payment_id: Number(subscriptionPaymentId) },
    relations: {
      subscription: {
        sponsorship: {
          sponsor: true,
          animal: true,
          plan: true,
        },
        payment_provider: true,
      },
      transaction: {
        category: true,
        payment_provider: true,
        payment_order: true,
        donor: true,
        payable_account: true,
        created_by: true,
        payable_payments: true,
        subscription_payments: true,
      },
    },
  });
}

async function loadSubscriptionPaymentByProviderPaymentId(repository, providerPaymentId) {
  return repository.findOne({
    where: { provider_payment_id: providerPaymentId },
    relations: {
      subscription: {
        sponsorship: {
          sponsor: true,
          animal: true,
          plan: true,
        },
        payment_provider: true,
      },
      transaction: {
        category: true,
        payment_provider: true,
        payment_order: true,
        donor: true,
        payable_account: true,
        created_by: true,
        payable_payments: true,
        subscription_payments: true,
      },
    },
  });
}

async function loadSponsorshipByPublicReference(repository, publicReference) {
  return repository.findOne({
    where: { public_reference: publicReference },
    relations: {
      sponsor: true,
      animal: true,
      plan: true,
      subscription: {
        payment_provider: true,
        payments: {
          transaction: true,
        },
      },
    },
  });
}

async function loadSponsorshipByIdempotencyKey(repository, idempotencyKey) {
  return repository.findOne({
    where: { creation_idempotency_key: idempotencyKey },
    relations: {
      sponsor: true,
      animal: true,
      plan: true,
      subscription: {
        payment_provider: true,
        payments: {
          transaction: true,
        },
      },
    },
  });
}

function assertProvisionablePlan(plan) {
  if (!plan) {
    throw new Error("Plan de apadrinamiento no encontrado.");
  }
  if ((plan.modalidad || "PAYPAL") !== "PAYPAL") {
    throw new Error("Solo los planes PayPal pueden aprovisionarse en PayPal.");
  }
  if (!plan.activo) {
    throw new Error("Solo se pueden aprovisionar planes activos.");
  }
  if (plan.moneda !== "USD") {
    throw new Error("Solo se pueden aprovisionar planes USD.");
  }
  if (plan.intervalo_unidad !== "MONTH" || Number(plan.intervalo_cantidad) !== 1) {
    throw new Error("Solo se pueden aprovisionar planes mensuales.");
  }
  if (Number(plan.monto) <= 0) {
    throw new Error("El plan debe tener un monto positivo.");
  }
}

function buildPlanDescription(plan) {
  return normalizeText(
    plan.descripcion || `Apadrinamiento mensual ${plan.nombre || `Plan ${plan.sponsorship_plan_id}`}`,
    `Apadrinamiento mensual ${plan.sponsorship_plan_id}`,
  );
}

function buildPaypalProvisionRequestIds(plan) {
  return {
    productRequestId: buildDeterministicPayPalRequestId(
      "paypal-sponsorship-product",
      process.env.NODE_ENV || "development",
      plan.sponsorship_plan_id,
      plan.nombre,
    ),
    planRequestId: buildDeterministicPayPalRequestId(
      "paypal-sponsorship-plan",
      process.env.NODE_ENV || "development",
      plan.sponsorship_plan_id,
      plan.nombre,
      plan.monto,
      plan.moneda,
    ),
  };
}

export async function provisionSponsorshipPlanPayPalService(params, dependencies = {}) {
  const {
    createProduct = createCatalogProduct,
    createPlan = createBillingPlan,
    getPlan = getBillingPlan,
  } = dependencies;

  try {
    const repository = AppDataSource.getRepository(SponsorshipPlan);
    const plan = await loadPlanWithRelations(repository, params.id);

    assertProvisionablePlan(plan);

    if (plan.paypal_plan_id) {
      const remotePlan = await getPlan(plan.paypal_plan_id);
      return [buildProvisionDto(plan, remotePlan?.status || "ACTIVE"), null];
    }

    const requestIds = buildPaypalProvisionRequestIds(plan);
    const paypalProductId = plan.paypal_product_id || (await createProduct({
      localPlanId: plan.sponsorship_plan_id,
      planName: plan.nombre,
      description: buildPlanDescription(plan),
      requestId: requestIds.productRequestId,
    })).id;

    if (!plan.paypal_product_id) {
      await repository.update(
        { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
        {
          paypal_product_id: paypalProductId,
        },
      );
    }

    const remotePlan = await createPlan({
      localPlanId: plan.sponsorship_plan_id,
      paypalProductId,
      planName: plan.nombre,
      description: buildPlanDescription(plan),
      amount: plan.monto,
      currencyCode: plan.moneda,
      requestId: requestIds.planRequestId,
    });

    await repository.update(
      { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
      {
        paypal_product_id: paypalProductId,
        paypal_plan_id: remotePlan.id,
      },
    );

    const updatedPlan = await loadPlanWithRelations(repository, plan.sponsorship_plan_id);
    return [buildProvisionDto(updatedPlan, remotePlan?.status || "ACTIVE"), null];
  } catch (error) {
    console.error("Error al aprovisionar plan PayPal de apadrinamiento:", error);
    return [null, error.message || "Error interno al aprovisionar el plan PayPal."];
  }
}

async function ensureSponsorForPublicStart(manager, sponsorPayload) {
  const repository = manager.getRepository(Sponsor);
  const existingSponsor = await repository.findOne({
    where: { email: sponsorPayload.email },
    relations: {
      sponsorships: true,
    },
  });

  if (existingSponsor) {
    if (!existingSponsor.activo) {
      throw buildPublicStartError(
        "No fue posible iniciar el apadrinamiento con los datos enviados.",
        409,
      );
    }

    return existingSponsor;
  }

  try {
    const sponsor = repository.create({
      ...sponsorPayload,
      consentimiento_datos_at: new Date(),
      activo: true,
    });

    return await repository.save(sponsor);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const recoveredSponsor = await repository.findOne({
      where: { email: sponsorPayload.email },
      relations: {
        sponsorships: true,
      },
    });

    if (!recoveredSponsor || !recoveredSponsor.activo) {
      throw buildPublicStartError(
        "No fue posible iniciar el apadrinamiento con los datos enviados.",
        409,
      );
    }

    return recoveredSponsor;
  }
}

async function assertNoDuplicatedActiveSponsorship(manager, sponsorId, animalId, excludeSponsorshipId = null) {
  const repository = manager.getRepository(Sponsorship);
  const matches = await repository.find({
    where: {
      sponsor: { sponsor_id: Number(sponsorId) },
      animal: { id_animal: Number(animalId) },
    },
  });

  const conflicting = matches.find((item) =>
    Number(item.sponsorship_id) !== Number(excludeSponsorshipId)
    && ACTIVE_SPONSORSHIP_STATES.has(item.estado));

  if (conflicting) {
    throw buildPublicStartError(
      "Ya existe un apadrinamiento activo o pendiente para este padrino y animal.",
      409,
    );
  }
}

function buildCreateSubscriptionRequestId(sponsorship, plan) {
  return buildDeterministicPayPalRequestId(
    "paypal-sponsorship-start",
    process.env.NODE_ENV || "development",
    sponsorship.creation_idempotency_key || "",
    sponsorship.public_reference,
    plan.paypal_plan_id,
  );
}

async function reserveLocalPublicStart(body, idempotencyKey) {
  return AppDataSource.transaction(async (manager) => {
    const sponsorshipRepository = manager.getRepository(Sponsorship);
    const subscriptionRepository = manager.getRepository(Subscription);
    const animalRepository = manager.getRepository(Animal);
    const planRepository = manager.getRepository(SponsorshipPlan);

    const existingByKey = await loadSponsorshipByIdempotencyKey(sponsorshipRepository, idempotencyKey);
    if (existingByKey) {
      return existingByKey;
    }

    const animal = await animalRepository.findOne({
      where: { id_animal: Number(body.animal_id) },
    });
    if (!animal || !isPublicAnimalEligible(animal)) {
      throw buildPublicStartError("El animal seleccionado no esta disponible para apadrinamiento.", 404);
    }

    const plan = await loadPlanWithRelations(planRepository, body.plan_id);
    if (!plan || !plan.activo) {
      throw buildPublicStartError("El plan seleccionado no esta disponible.", 404);
    }
    if (!plan.paypal_plan_id || !plan.paypal_product_id) {
      throw buildPublicStartError("El plan seleccionado aun no esta configurado para PayPal.", 409);
    }
    assertProvisionablePlan(plan);

    const sponsor = await ensureSponsorForPublicStart(manager, normalizePublicSponsorPayload(body));

    await lockRowIfPossible(manager.getRepository(Sponsor), "sponsor", "sponsor_id", sponsor.sponsor_id);
    await lockRowIfPossible(manager.getRepository(Animal), "animal", "id_animal", animal.id_animal);

    await assertNoDuplicatedActiveSponsorship(manager, sponsor.sponsor_id, animal.id_animal);

    const sponsorship = sponsorshipRepository.create({
      sponsor: { sponsor_id: Number(sponsor.sponsor_id) },
      animal: { id_animal: Number(animal.id_animal) },
      plan: { sponsorship_plan_id: Number(plan.sponsorship_plan_id) },
      estado: "PENDIENTE_APROBACION",
      public_reference: createPublicReference(),
      creation_idempotency_key: idempotencyKey,
      solicitado_en: new Date(),
    });
    const savedSponsorship = await sponsorshipRepository.save(sponsorship);

    const paypalProvider = await getPaymentProviderByKeyOrThrow(manager, PAYPAL_PROVIDER_KEY, {
      onlyActive: true,
    });

    const subscription = subscriptionRepository.create({
      sponsorship: { sponsorship_id: Number(savedSponsorship.sponsorship_id) },
      payment_provider: { proveedor_pago_id: Number(paypalProvider.proveedor_pago_id) },
      estado: "CREADA",
      provider_plan_id: plan.paypal_plan_id,
      metadata: {
        custom_id: savedSponsorship.public_reference,
      },
    });
    await subscriptionRepository.save(subscription);

    return loadSponsorshipByIdempotencyKey(sponsorshipRepository, idempotencyKey);
  });
}

function buildCanonicalProviderTimestamp(payload) {
  return (
    normalizeString(payload?.status_update_time)
    || normalizeString(payload?.update_time)
    || normalizeString(payload?.create_time)
    || null
  );
}

async function applyCanonicalSubscriptionState(manager, localSubscription, providerPayload, {
  source,
  reason = null,
  markSyncedAt = false,
} = {}) {
  const subscriptionRepository = manager.getRepository(Subscription);
  const sponsorshipRepository = manager.getRepository(Sponsorship);
  const providerStatus = normalizeText(providerPayload?.status);
  const mappedState = mapPayPalSubscriptionStatusToLocal(providerStatus);
  const providerTimestamp = buildCanonicalProviderTimestamp(providerPayload);

  const subscription = await loadSubscriptionWithRelations(
    subscriptionRepository,
    localSubscription.subscription_id,
  );
  const sponsorship = await manager.getRepository(Sponsorship).findOne({
    where: { sponsorship_id: Number(subscription.sponsorship.sponsorship_id) },
  });

  if (!shouldIgnoreProviderStateTransition(subscription, mappedState, providerTimestamp)) {
    if (mappedState) {
      subscription.estado = mappedState;
    }

    const sponsorshipState = mapSubscriptionStateToSponsorshipState(subscription.estado);
    if (sponsorshipState) {
      sponsorship.estado = sponsorshipState;
    }

    if (subscription.estado === "ACTIVA" && !sponsorship.activado_en) {
      sponsorship.activado_en = new Date();
    }

    if (
      (subscription.estado === "CANCELADA" || subscription.estado === "EXPIRADA")
      && !sponsorship.cancelado_en
    ) {
      sponsorship.cancelado_en = new Date();
      sponsorship.motivo_cancelacion = normalizeText(reason) || sponsorship.motivo_cancelacion || null;
    }
  }

  subscription.provider_subscription_id =
    normalizeString(providerPayload?.id) || subscription.provider_subscription_id;
  subscription.provider_plan_id =
    normalizeString(providerPayload?.plan_id) || subscription.provider_plan_id;
  subscription.payer_id =
    normalizeString(providerPayload?.subscriber?.payer_id)
    || normalizeString(providerPayload?.subscriber?.payer_info?.payer_id)
    || subscription.payer_id;
  subscription.payer_email =
    normalizeString(providerPayload?.subscriber?.email_address)
    || subscription.payer_email;
  subscription.next_billing_time = normalizeString(providerPayload?.billing_info?.next_billing_time)
    ? new Date(providerPayload.billing_info.next_billing_time)
    : subscription.next_billing_time;
  subscription.provider_status_updated_at = providerTimestamp
    ? new Date(providerTimestamp)
    : subscription.provider_status_updated_at;
  subscription.last_synced_at = markSyncedAt ? new Date() : subscription.last_synced_at;
  subscription.metadata = mergeSubscriptionMetadata(subscription, {
    custom_id: normalizeString(providerPayload?.custom_id) || subscription.metadata?.custom_id || null,
    last_provider_status: providerStatus,
    last_reconciled_from: source,
  });

  await sponsorshipRepository.save(sponsorship);
  await subscriptionRepository.update(
    { subscription_id: Number(subscription.subscription_id) },
    {
      estado: subscription.estado,
      provider_subscription_id: subscription.provider_subscription_id,
      provider_plan_id: subscription.provider_plan_id,
      approval_url: subscription.approval_url,
      payer_id: subscription.payer_id,
      payer_email: subscription.payer_email,
      next_billing_time: subscription.next_billing_time,
      last_synced_at: subscription.last_synced_at,
      provider_status_updated_at: subscription.provider_status_updated_at,
      metadata: subscription.metadata,
    },
  );

  return loadSubscriptionWithRelations(subscriptionRepository, subscription.subscription_id);
}

async function ensureRemoteSubscriptionCreated(sponsorshipRecord, dependencies = {}) {
  const {
    createSubscriptionFn = createPayPalSubscription,
  } = dependencies;

  const subscription = sponsorshipRecord.subscription;
  const plan = sponsorshipRecord.plan;

  if (subscription.provider_subscription_id && subscription.approval_url) {
    return subscription;
  }

  const requestId = buildCreateSubscriptionRequestId(sponsorshipRecord, plan);

  try {
    const createdRemote = await createSubscriptionFn({
      paypalPlanId: plan.paypal_plan_id,
      publicReference: sponsorshipRecord.public_reference,
      animalId: sponsorshipRecord.animal?.id_animal,
      sponsor: sponsorshipRecord.sponsor,
      requestId,
      customId: sponsorshipRecord.public_reference,
    });

    await AppDataSource.transaction(async (manager) => {
      const subscriptionRepository = manager.getRepository(Subscription);
      await subscriptionRepository.update(
        { subscription_id: Number(subscription.subscription_id) },
        {
          provider_subscription_id: createdRemote.payload.id,
          provider_plan_id: createdRemote.payload.plan_id || plan.paypal_plan_id,
          approval_url: createdRemote.approvalUrl,
          estado: "APROBACION_PENDIENTE",
          metadata: {
            ...sanitizeSubscriptionMetadata(subscription.metadata || {}),
            custom_id: sponsorshipRecord.public_reference,
            paypal_create_request_id: requestId,
            last_provider_status: normalizeText(createdRemote.payload.status) || "APPROVAL_PENDING",
          },
        },
      );
    });
  } catch (error) {
    if (isDefinitivePayPalError(error)) {
      await AppDataSource.transaction(async (manager) => {
        await manager.getRepository(Subscription).update(
          { subscription_id: Number(subscription.subscription_id) },
          {
            estado: "FALLIDA",
            metadata: {
              ...sanitizeSubscriptionMetadata(subscription.metadata || {}),
              custom_id: sponsorshipRecord.public_reference,
              paypal_create_request_id: requestId,
              last_error_code: error.code || null,
              last_error_status: error.statusCode || null,
            },
          },
        );
      });
    }

    throw error;
  }

  const reloaded = await AppDataSource.getRepository(Sponsorship).findOne({
    where: { sponsorship_id: Number(sponsorshipRecord.sponsorship_id) },
    relations: {
      sponsor: true,
      animal: true,
      plan: true,
      subscription: {
        payment_provider: true,
        payments: {
          transaction: true,
        },
      },
    },
  });

  return reloaded.subscription;
}

export async function startPublicSponsorshipService(body, { idempotencyKey, ...dependencies } = {}) {
  try {
    const normalizedIdempotencyKey = normalizePublicIdempotencyKey(idempotencyKey);
    const sponsorship = await reserveLocalPublicStart(body, normalizedIdempotencyKey);
    const subscription = await ensureRemoteSubscriptionCreated(sponsorship, dependencies);

    return [buildPublicSponsorshipStartDto(sponsorship, subscription), null];
  } catch (error) {
    console.error("Error al iniciar apadrinamiento publico:", error);

    if (error?.publicSafe) {
      return [null, error];
    }

    if (isTimeoutOrUncertainPayPalError(error)) {
      return [null, buildServiceError(
        "PayPal no pudo confirmar la suscripcion en este momento. Reintenta con la misma Idempotency-Key.",
        502,
      )];
    }

    if (error instanceof PayPalApiError) {
      return [null, buildServiceError("No fue posible iniciar la suscripcion PayPal.", 502)];
    }

    return [null, normalizePublicError(error, "Error interno al iniciar el apadrinamiento.")];
  }
}

export async function getPublicSponsorshipStatusService(params) {
  try {
    const repository = AppDataSource.getRepository(Sponsorship);
    const sponsorship = await loadSponsorshipByPublicReference(
      repository,
      normalizeString(params.publicReference),
    );

    if (!sponsorship || !sponsorship.subscription) {
      return [null, "Apadrinamiento no encontrado."];
    }

    const mainImage = await loadAnimalMainImage(AppDataSource.manager, sponsorship.animal?.id_animal);
    return [buildPublicSponsorshipStatusDto(sponsorship, sponsorship.subscription, mainImage), null];
  } catch (error) {
    console.error("Error al obtener estado publico del apadrinamiento:", error);
    return [null, "Error interno al obtener el estado del apadrinamiento."];
  }
}

function buildSafeTransactionsRange(lastSyncedAt) {
  const endDate = new Date();
  const baseStart = lastSyncedAt
    ? new Date(new Date(lastSyncedAt).getTime() - SAFE_SYNC_OVERLAP_DAYS * 24 * 60 * 60 * 1000)
    : new Date(endDate.getTime() - DEFAULT_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  return {
    startDate: baseStart,
    endDate,
  };
}

function normalizeSubscriptionTransactionAmount(amount) {
  if (!amount) return null;

  return {
    currencyCode: normalizeCurrency(amount.currency_code),
    value: Number(amount.value),
  };
}

export function normalizeCanonicalSubscriptionTransaction(item = {}) {
  const gross = normalizeSubscriptionTransactionAmount(
    item.amount_with_breakdown?.gross_amount || item.amount,
  );
  const fee = normalizeSubscriptionTransactionAmount(item.amount_with_breakdown?.fee_amount)
    || { currencyCode: gross?.currencyCode || "USD", value: 0 };
  const net = normalizeSubscriptionTransactionAmount(item.amount_with_breakdown?.net_amount)
    || { currencyCode: gross?.currencyCode || "USD", value: Number((gross?.value || 0) - fee.value).toFixed(2) };

  if (!gross || !Number.isFinite(gross.value) || gross.value <= 0) {
    throw buildServiceError("La transaccion canonica de PayPal no tiene un monto bruto valido.", 409);
  }

  return {
    providerPaymentId: normalizeString(item.id),
    status: normalizeText(item.status) || "UNKNOWN",
    currencyCode: gross.currencyCode,
    grossAmount: Number(gross.value.toFixed(2)),
    feeAmount: Number((fee.value || 0).toFixed(2)),
    netAmount: Number((net.value || (gross.value - fee.value)).toFixed(2)),
    occurredAt: normalizeString(item.time) || normalizeString(item.create_time) || new Date().toISOString(),
    payerEmail: normalizeString(item.payer_email),
    payerName: normalizeText(item.payer_name),
  };
}

async function getCoreRecurringAccountingDependencies(manager) {
  const [provider, category] = await Promise.all([
    getPaymentProviderByKeyOrThrow(manager, PAYPAL_PROVIDER_KEY, { onlyActive: true }),
    getTransactionCategoryByKeyOrThrow(manager, APADRINAMIENTO_CATEGORY_KEY, { onlyActive: true }),
  ]);

  return { provider, category };
}

async function createOrReuseIncomeTransaction(manager, subscriptionPayment, canonicalPayment, source) {
  const transactionRepository = manager.getRepository(Transaction);
  const { provider, category } = await getCoreRecurringAccountingDependencies(manager);
  const idempotencyKey = `paypal:subscription-sale:${canonicalPayment.providerPaymentId}`;

  let transaction = await transactionRepository.findOne({
    where: { idempotencia_key: idempotencyKey },
    relations: {
      category: true,
      payment_provider: true,
      payment_order: true,
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
      subscription_payments: true,
    },
  });

  if (!transaction) {
    transaction = transactionRepository.create({
      tipo: "INGRESO",
      descripcion: "Pago recurrente PayPal de apadrinamiento",
      moneda: canonicalPayment.currencyCode,
      monto_bruto: canonicalPayment.grossAmount,
      monto_fee: canonicalPayment.feeAmount,
      monto_neto: canonicalPayment.netAmount,
      fecha_transaccion: new Date(canonicalPayment.occurredAt),
      estado: "CONFIRMADA",
      origen_tipo: "PAYPAL_SUBSCRIPTION_PAYMENT",
      origen_id: Number(subscriptionPayment.subscription_payment_id),
      referencia_externa: canonicalPayment.providerPaymentId,
      idempotencia_key: idempotencyKey,
      metadata: {
        subscription_id: Number(subscriptionPayment.subscription.subscription_id),
        sponsorship_id: Number(subscriptionPayment.subscription.sponsorship?.sponsorship_id || 0) || null,
        public_reference: subscriptionPayment.subscription.sponsorship?.public_reference || null,
        provider_payment_id: canonicalPayment.providerPaymentId,
        provider_subscription_id: subscriptionPayment.subscription.provider_subscription_id || null,
        reconciled_from: source,
      },
      category: {
        categoria_transaccion_id: Number(category.categoria_transaccion_id),
      },
      payment_provider: {
        proveedor_pago_id: Number(provider.proveedor_pago_id),
      },
    });

    transaction = await transactionRepository.save(transaction);
  }

  return transactionRepository.findOne({
    where: { transaccion_id: Number(transaction.transaccion_id) },
    relations: {
      category: true,
      payment_provider: true,
      payment_order: true,
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
      subscription_payments: true,
    },
  });
}

async function reconcileCompletedCanonicalPayment(manager, subscription, canonicalPayment, source) {
  const paymentRepository = manager.getRepository(SubscriptionPayment);
  let payment = await paymentRepository.findOne({
    where: { provider_payment_id: canonicalPayment.providerPaymentId },
    relations: {
      subscription: {
        sponsorship: true,
      },
      transaction: true,
    },
  });

  if (!payment) {
    payment = paymentRepository.create({
      subscription: { subscription_id: Number(subscription.subscription_id) },
      provider_payment_id: canonicalPayment.providerPaymentId,
      estado: "COMPLETADO",
      moneda: canonicalPayment.currencyCode,
      monto_bruto: canonicalPayment.grossAmount,
      monto_fee: canonicalPayment.feeAmount,
      monto_neto: canonicalPayment.netAmount,
      occurred_at: new Date(canonicalPayment.occurredAt),
      metadata: {
        payer_email: canonicalPayment.payerEmail,
        payer_name: canonicalPayment.payerName,
        reconciled_from: source,
      },
    });
    payment = await paymentRepository.save(payment);
  } else {
    await paymentRepository.update(
      { subscription_payment_id: Number(payment.subscription_payment_id) },
      {
        estado: "COMPLETADO",
        moneda: canonicalPayment.currencyCode,
        monto_bruto: canonicalPayment.grossAmount,
        monto_fee: canonicalPayment.feeAmount,
        monto_neto: canonicalPayment.netAmount,
        occurred_at: new Date(canonicalPayment.occurredAt),
        metadata: {
          ...(payment.metadata || {}),
          payer_email: canonicalPayment.payerEmail,
          payer_name: canonicalPayment.payerName,
          reconciled_from: source,
        },
      },
    );
    payment = await paymentRepository.findOne({
      where: { subscription_payment_id: Number(payment.subscription_payment_id) },
      relations: {
        subscription: {
          sponsorship: true,
        },
        transaction: true,
      },
    });
  }

  if (!payment.transaction) {
    const paymentWithRelations = await paymentRepository.findOne({
      where: { subscription_payment_id: Number(payment.subscription_payment_id) },
      relations: {
        subscription: {
          sponsorship: true,
        },
        transaction: true,
      },
    });
    const transaction = await createOrReuseIncomeTransaction(
      manager,
      paymentWithRelations,
      canonicalPayment,
      source,
    );

    await paymentRepository.save({
      subscription_payment_id: Number(payment.subscription_payment_id),
      transaction: { transaccion_id: Number(transaction.transaccion_id) },
    });
  }

  return paymentRepository.findOne({
    where: { subscription_payment_id: Number(payment.subscription_payment_id) },
    relations: {
      subscription: {
        sponsorship: true,
      },
      transaction: {
        category: true,
        payment_provider: true,
        payment_order: true,
        donor: true,
        payable_account: true,
        created_by: true,
        payable_payments: true,
        subscription_payments: true,
      },
    },
  });
}

function normalizePayPalSubscriptionId(value) {
  const normalized = normalizeString(value);

  if (!normalized || !/^I-[A-Z0-9]+$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractProviderSubscriptionId(webhookEvent = {}) {
  const resource = webhookEvent?.resource || {};
  const eventType = String(webhookEvent?.event_type || "")
    .trim()
    .toUpperCase();

  /*
   * En eventos PAYMENT.SALE.*, resource.id es el ID del pago,
   * no el ID de la suscripción.
   */
  if (eventType.startsWith("PAYMENT.SALE.")) {
    return (
      normalizePayPalSubscriptionId(resource.billing_agreement_id)
      || normalizePayPalSubscriptionId(resource.subscription_id)
      || normalizePayPalSubscriptionId(
        resource.supplementary_data?.related_ids?.billing_agreement_id,
      )
      || null
    );
  }

  /*
   * En eventos BILLING.SUBSCRIPTION.*, resource.id sí corresponde
   * normalmente al ID de la suscripción.
   */
  return (
    normalizePayPalSubscriptionId(resource.id)
    || normalizePayPalSubscriptionId(resource.billing_agreement_id)
    || normalizePayPalSubscriptionId(resource.subscription_id)
    || normalizePayPalSubscriptionId(
      resource.supplementary_data?.related_ids?.billing_agreement_id,
    )
    || null
  );
}

function extractCustomReference(resource = {}) {
  return (
    normalizeString(resource.custom_id)
    || normalizeString(resource.custom)
    || null
  );
}
function extractWebhookResourceTimestamp(webhookEvent) {
  return (
    normalizeString(webhookEvent?.resource?.status_update_time)
    || normalizeString(webhookEvent?.resource?.update_time)
    || normalizeString(webhookEvent?.create_time)
    || null
  );
}

async function resolveLocalSubscriptionForWebhook(webhookEvent, { getSubscriptionFn = getPayPalSubscription } = {}) {
  const subscriptionRepository = AppDataSource.getRepository(Subscription);
  const providerSubscriptionId = extractProviderSubscriptionId(webhookEvent);
  const customReference = extractCustomReference(webhookEvent?.resource || {});
  if (providerSubscriptionId) {
    const byProviderId = await loadSubscriptionByProviderId(subscriptionRepository, providerSubscriptionId);
    if (byProviderId) return byProviderId;
  }

  if (customReference) {
    const byReference = await subscriptionRepository.findOne({
      where: {
        sponsorship: {
          public_reference: customReference,
        },
      },
      relations: {
        sponsorship: {
          sponsor: true,
          animal: true,
          plan: true,
        },
        payment_provider: true,
        payments: {
          transaction: true,
        },
      },
    });

    if (byReference) return byReference;
  }

  if (providerSubscriptionId) {
    const canonical = await getSubscriptionFn(providerSubscriptionId);
    const canonicalReference = normalizeString(canonical?.custom_id);
    if (canonicalReference) {
      const byCanonicalReference = await subscriptionRepository.findOne({
        where: {
          sponsorship: {
            public_reference: canonicalReference,
          },
        },
        relations: {
          sponsorship: {
            sponsor: true,
            animal: true,
            plan: true,
          },
          payment_provider: true,
          payments: {
            transaction: true,
          },
        },
      });

      if (byCanonicalReference) {
        return byCanonicalReference;
      }
    }
  }

  throw buildServiceError(
    "No fue posible asociar el evento PayPal con una suscripcion local.",
    409,
  );
}

async function syncCanonicalSubscriptionTransactions(subscription, {
  listTransactionsFn = listAllSubscriptionTransactions,
  source,
  targetProviderPaymentId = null,
} = {}) {
  const range = buildSafeTransactionsRange(subscription.last_synced_at);
  const canonicalTransactions = await listTransactionsFn(subscription.provider_subscription_id, range);
  const normalizedTransactions = canonicalTransactions
    .map((item) => {
      try {
        return normalizeCanonicalSubscriptionTransaction(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => item.status === "COMPLETED")
    .filter((item) => !targetProviderPaymentId || item.providerPaymentId === targetProviderPaymentId);

  return AppDataSource.transaction(async (manager) => {
    let currentSubscription = await loadSubscriptionWithRelations(
      manager.getRepository(Subscription),
      subscription.subscription_id,
    );
    const reconciledPayments = [];

    for (const canonicalPayment of normalizedTransactions) {
      const payment = await reconcileCompletedCanonicalPayment(
        manager,
        currentSubscription,
        canonicalPayment,
        source,
      );
      reconciledPayments.push(payment);
      currentSubscription = await loadSubscriptionWithRelations(
        manager.getRepository(Subscription),
        subscription.subscription_id,
      );
    }

    await manager.getRepository(Subscription).update(
      { subscription_id: Number(currentSubscription.subscription_id) },
      { last_synced_at: new Date() },
    );

    return reconciledPayments;
  });
}

async function buildAdminSubscriptionResponse(subscriptionId) {
  const repository = AppDataSource.getRepository(Subscription);
  const subscription = await loadSubscriptionWithRelations(repository, subscriptionId);
  return mapAdminSubscription(subscription);
}

async function buildAdminSubscriptionPaymentResponse(subscriptionPaymentId) {
  const repository = AppDataSource.getRepository(SubscriptionPayment);
  const payment = await loadSubscriptionPaymentWithRelations(repository, subscriptionPaymentId);
  return mapAdminSubscriptionPayment(payment);
}

function isManualSubscriptionRecord(subscription) {
  return subscription?.payment_provider?.clave === MANUAL_PROVIDER_KEY;
}

export async function syncSubscriptionService(params, dependencies = {}) {
  const {
    getSubscriptionFn = getPayPalSubscription,
    listTransactionsFn = listAllSubscriptionTransactions,
  } = dependencies;

  try {
    const repository = AppDataSource.getRepository(Subscription);
    const subscription = await loadSubscriptionWithRelations(repository, params.id);

    if (!subscription) {
      return [null, "Suscripcion no encontrada."];
    }
    if (!subscription.provider_subscription_id) {
      return [null, "La suscripcion no tiene provider_subscription_id."];
    }

    const canonicalSubscription = await getSubscriptionFn(subscription.provider_subscription_id);

    await AppDataSource.transaction(async (manager) => {
      await applyCanonicalSubscriptionState(manager, subscription, canonicalSubscription, {
        source: "admin:subscription-sync",
        markSyncedAt: true,
      });
    });

    await syncCanonicalSubscriptionTransactions(subscription, {
      listTransactionsFn,
      source: "admin:subscription-sync",
    });

    return [await buildAdminSubscriptionResponse(subscription.subscription_id), null];
  } catch (error) {
    console.error("Error al sincronizar suscripcion PayPal:", error);
    return [null, error.message || "Error interno al sincronizar la suscripcion."];
  }
}

export async function cancelSubscriptionService(params, body, dependencies = {}) {
  const {
    cancelFn = cancelPayPalSubscription,
    getSubscriptionFn = getPayPalSubscription,
  } = dependencies;

  try {
    const repository = AppDataSource.getRepository(Subscription);
    const subscription = await loadSubscriptionWithRelations(repository, params.id);

    if (!subscription) {
      return [null, "Suscripcion no encontrada."];
    }
    if (subscription.estado === "CANCELADA") {
      return [await buildAdminSubscriptionResponse(subscription.subscription_id), null];
    }

    if (isManualSubscriptionRecord(subscription)) {
      await AppDataSource.transaction(async (manager) => {
        const currentSubscription = await loadSubscriptionWithRelations(
          manager.getRepository(Subscription),
          subscription.subscription_id,
        );
        const cancellationDate = new Date();
        const currentReason = normalizeText(body.motivo);

        await manager.getRepository(Sponsorship).update(
          { sponsorship_id: Number(currentSubscription.sponsorship.sponsorship_id) },
          {
            estado: "CANCELADO",
            cancelado_en: currentSubscription.sponsorship.cancelado_en || cancellationDate,
            motivo_cancelacion:
              currentReason || currentSubscription.sponsorship.motivo_cancelacion || null,
          },
        );

        await manager.getRepository(Subscription).update(
          { subscription_id: Number(currentSubscription.subscription_id) },
          {
            estado: "CANCELADA",
            last_synced_at: cancellationDate,
            provider_status_updated_at: cancellationDate,
            metadata: mergeSubscriptionMetadata(currentSubscription, {
              last_provider_status: "MANUAL_CANCELLED",
              last_reconciled_from: "admin:subscription-cancel",
              cancellation_reason: currentReason || null,
            }),
          },
        );
      });

      return [await buildAdminSubscriptionResponse(subscription.subscription_id), null];
    }

    if (!subscription.provider_subscription_id) {
      return [null, "La suscripcion no tiene provider_subscription_id."];
    }

    await cancelFn(subscription.provider_subscription_id, {
      reason: body.motivo,
      requestId: buildDeterministicPayPalRequestId(
        "paypal-subscription-admin-cancel",
        subscription.subscription_id,
        body.motivo,
      ),
    });

    const canonical = await getSubscriptionFn(subscription.provider_subscription_id);
    const mappedState = mapPayPalSubscriptionStatusToLocal(canonical?.status);
    if (mappedState !== "CANCELADA") {
      throw buildServiceError("PayPal no confirmo la cancelacion de la suscripcion.", 502);
    }

    await AppDataSource.transaction(async (manager) => {
      await applyCanonicalSubscriptionState(manager, subscription, canonical, {
        source: "admin:subscription-cancel",
        reason: body.motivo,
        markSyncedAt: true,
      });
    });

    return [await buildAdminSubscriptionResponse(subscription.subscription_id), null];
  } catch (error) {
    console.error("Error al cancelar suscripcion PayPal:", error);
    return [null, error.message || "Error interno al cancelar la suscripcion."];
  }
}

export async function createManualSubscriptionPaymentService(
  body,
  { idempotencyKey, authContext = {} } = {},
) {
  try {
    const normalizedIdempotencyKey = normalizeAdminIdempotencyKey(idempotencyKey);
    const providerPaymentId = `MANUAL-${normalizedIdempotencyKey}`;
    const transactionIdempotencyKey = `manual:sponsorship-payment:${normalizedIdempotencyKey}`;

    const existingRepository = AppDataSource.getRepository(SubscriptionPayment);
    const existingPayment = await loadSubscriptionPaymentByProviderPaymentId(
      existingRepository,
      providerPaymentId,
    );
    if (existingPayment) {
      return [mapAdminSubscriptionPayment(existingPayment), null];
    }

    const paymentId = await AppDataSource.transaction(async (manager) => {
      const subscriptionRepository = manager.getRepository(Subscription);
      const paymentRepository = manager.getRepository(SubscriptionPayment);
      const transactionRepository = manager.getRepository(Transaction);

      const duplicatedPayment = await loadSubscriptionPaymentByProviderPaymentId(
        paymentRepository,
        providerPaymentId,
      );
      if (duplicatedPayment) {
        return Number(duplicatedPayment.subscription_payment_id);
      }

      const subscription = await loadSubscriptionWithRelations(
        subscriptionRepository,
        body.subscription_id,
      );

      if (!subscription) {
        throw buildServiceError("Suscripcion no encontrada.", 404);
      }
      if (!isManualSubscriptionRecord(subscription)) {
        throw buildServiceError(
          "Solo se pueden registrar pagos manuales sobre apadrinamientos manuales.",
          400,
        );
      }
      if (subscription.estado !== "ACTIVA" || subscription.sponsorship?.estado !== "ACTIVO") {
        throw buildServiceError(
          "Solo se pueden registrar pagos manuales sobre apadrinamientos manuales activos.",
          400,
        );
      }

      const amount = ensurePositiveAmount(body.monto, "El monto");
      const currency = normalizeCurrency(body.moneda);
      const expectedCurrency = normalizeCurrency(subscription.sponsorship?.plan?.moneda || "USD");
      if (subscription.sponsorship?.plan?.modalidad !== "MANUAL") {
        throw buildServiceError(
          "Solo se pueden registrar pagos manuales sobre planes manuales activos.",
          400,
        );
      }
      if (currency !== expectedCurrency) {
        throw buildServiceError("La moneda del pago debe coincidir con la moneda del plan.", 400);
      }
      const nextBillingTime = addOneCalendarMonth(body.fecha_pago);

      const [manualProvider, category] = await Promise.all([
        getPaymentProviderByKeyOrThrow(manager, MANUAL_PROVIDER_KEY, { onlyActive: true }),
        getTransactionCategoryByKeyOrThrow(manager, APADRINAMIENTO_CATEGORY_KEY, {
          onlyActive: true,
        }),
      ]);

      const payment = paymentRepository.create({
        subscription: { subscription_id: Number(subscription.subscription_id) },
        provider_payment_id: providerPaymentId,
        estado: "COMPLETADO",
        moneda: currency,
        monto_bruto: amount,
        monto_fee: 0,
        monto_neto: amount,
        occurred_at: new Date(body.fecha_pago),
        metadata: sanitizeSubscriptionMetadata({
          metodo: normalizeText(body.metodo),
          referencia: normalizeText(body.referencia),
          observacion: normalizeText(body.observacion),
          registrado_por_user_id: authContext.userId ? Number(authContext.userId) : null,
        }),
      });
      const savedPayment = await paymentRepository.save(payment);

      const transaction = transactionRepository.create({
        tipo: "INGRESO",
        descripcion: "Pago manual de apadrinamiento",
        moneda: currency,
        monto_bruto: amount,
        monto_fee: 0,
        monto_neto: amount,
        fecha_transaccion: new Date(body.fecha_pago),
        estado: "CONFIRMADA",
        origen_tipo: "MANUAL_SPONSORSHIP_PAYMENT",
        origen_id: Number(savedPayment.subscription_payment_id),
        referencia_externa: normalizeText(body.referencia) || providerPaymentId,
        idempotencia_key: transactionIdempotencyKey,
        metadata: sanitizeSubscriptionMetadata({
          subscription_payment_id: Number(savedPayment.subscription_payment_id),
          sponsorship_id: Number(subscription.sponsorship?.sponsorship_id),
          sponsor_id: Number(subscription.sponsorship?.sponsor?.sponsor_id),
          animal_id: Number(subscription.sponsorship?.animal?.id_animal),
          metodo: normalizeText(body.metodo),
          referencia: normalizeText(body.referencia),
          observacion: normalizeText(body.observacion),
          registrado_por_user_id: authContext.userId ? Number(authContext.userId) : null,
        }),
        category: { categoria_transaccion_id: Number(category.categoria_transaccion_id) },
        payment_provider: { proveedor_pago_id: Number(manualProvider.proveedor_pago_id) },
        created_by: authContext.userId
          ? { id_usuario: Number(authContext.userId) }
          : null,
      });
      const savedTransaction = await transactionRepository.save(transaction);

      await manager
        .createQueryBuilder()
        .relation(SubscriptionPayment, "transaction")
        .of(Number(savedPayment.subscription_payment_id))
        .set(Number(savedTransaction.transaccion_id));

      await subscriptionRepository.update(
        { subscription_id: Number(subscription.subscription_id) },
        {
          next_billing_time: nextBillingTime,
          last_synced_at: subscription.last_synced_at || null,
          metadata: mergeSubscriptionMetadata(subscription, {
            last_manual_payment_id: Number(savedPayment.subscription_payment_id),
            last_manual_payment_at: new Date(body.fecha_pago).toISOString(),
          }),
        },
      );

      return Number(savedPayment.subscription_payment_id);
    });

    return [await buildAdminSubscriptionPaymentResponse(paymentId), null];
  } catch (error) {
    console.error("Error al registrar pago manual de apadrinamiento:", error);
    return [null, error.message || "Error interno al registrar el pago manual."];
  }
}

export async function reconcileSubscriptionStateWebhook(webhookEvent, dependencies = {}) {
  const { getSubscriptionFn = getPayPalSubscription } = dependencies;
  const localSubscription = await resolveLocalSubscriptionForWebhook(webhookEvent, { getSubscriptionFn });
  const providerSubscriptionId = extractProviderSubscriptionId(webhookEvent);
  const canonical = providerSubscriptionId
    ? await getSubscriptionFn(providerSubscriptionId)
    : webhookEvent.resource;

  await AppDataSource.transaction(async (manager) => {
    await applyCanonicalSubscriptionState(manager, localSubscription, canonical, {
      source: `webhook:${webhookEvent.event_type}`,
      reason: webhookEvent.resource?.status_change_note || null,
      markSyncedAt: true,
    });
  });

  return buildAdminSubscriptionResponse(localSubscription.subscription_id);
}

function buildSaleLookupWindow(eventTimestamp) {
  const center = eventTimestamp ? new Date(eventTimestamp) : new Date();
  const startDate = new Date(center.getTime() - 35 * 24 * 60 * 60 * 1000);
  const endDate = new Date(center.getTime() + 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

function extractProviderPaymentIdFromSaleResource(resource = {}) {
  return normalizeString(resource.id) || normalizeString(resource.sale_id);
}

export async function reconcileSubscriptionSaleCompletedWebhook(webhookEvent, dependencies = {}) {
  const {
    getSubscriptionFn = getPayPalSubscription,
    listTransactionsFn = listAllSubscriptionTransactions,
  } = dependencies;
const localSubscription = await resolveLocalSubscriptionForWebhook(
  webhookEvent,
  { getSubscriptionFn },
);

const providerPaymentId =
  extractProviderPaymentIdFromSaleResource(
    webhookEvent.resource || {},
  );

const providerSubscriptionId =
  normalizePayPalSubscriptionId(
    localSubscription.provider_subscription_id,
  );

if (!providerSubscriptionId) {
  throw buildServiceError(
    "La suscripcion local no tiene un provider_subscription_id valido.",
    409,
  );
}

/*
 * La suscripción local ya fue localizada usando billing_agreement_id.
 * Nunca usar resource.id aquí, porque en PAYMENT.SALE.COMPLETED
 * corresponde al ID del pago.
 */
const canonical = await getSubscriptionFn(
  providerSubscriptionId,
);
  await AppDataSource.transaction(async (manager) => {
    await applyCanonicalSubscriptionState(manager, localSubscription, canonical, {
      source: `webhook:${webhookEvent.event_type}`,
      markSyncedAt: true,
    });
  });

  const sales = await listTransactionsFn(
    localSubscription.provider_subscription_id,
    buildSaleLookupWindow(extractWebhookResourceTimestamp(webhookEvent)),
  );
  const matchingSales = sales
    .map((item) => {
      try {
        return normalizeCanonicalSubscriptionTransaction(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => item.status === "COMPLETED")
    .filter((item) => !providerPaymentId || item.providerPaymentId === providerPaymentId);

  if (matchingSales.length === 0) {
    throw buildServiceError(
      "No fue posible reconciliar el pago recurrente completado con PayPal.",
      409,
    );
  }

  const reconciledPayments = await AppDataSource.transaction(async (manager) => {
    const payments = [];
    let currentSubscription = await loadSubscriptionWithRelations(
      manager.getRepository(Subscription),
      localSubscription.subscription_id,
    );
    for (const payment of matchingSales) {
      payments.push(await reconcileCompletedCanonicalPayment(
        manager,
        currentSubscription,
        payment,
        `webhook:${webhookEvent.event_type}`,
      ));
      currentSubscription = await loadSubscriptionWithRelations(
        manager.getRepository(Subscription),
        localSubscription.subscription_id,
      );
    }
    return payments;
  });

  return {
    subscription: await buildAdminSubscriptionResponse(localSubscription.subscription_id),
    payments: reconciledPayments.map((payment) => ({
      subscription_payment_id: Number(payment.subscription_payment_id),
      transaction_id: payment.transaction?.transaccion_id ? Number(payment.transaction.transaccion_id) : null,
    })),
  };
}
function normalizeFailedSaleFromWebhook(
  resource = {},
  eventType = "",
) {
  const amount = resource.amount
    ? {
        currencyCode: normalizeCurrency(
          resource.amount.currency_code
          || resource.amount.currency,
        ),
        value: Number(
          resource.amount.value
          ?? resource.amount.total,
        ),
      }
    : null;

  return {
    providerPaymentId:
      extractProviderPaymentIdFromSaleResource(resource),

    providerSubscriptionId:
      extractProviderSubscriptionId({
        event_type: eventType,
        resource,
      }),

    currencyCode: amount?.currencyCode || "USD",

    grossAmount: Number.isFinite(amount?.value)
      ? amount.value
      : null,

    occurredAt:
      normalizeString(resource.time)
      || normalizeString(resource.create_time)
      || null,
  };
}

export async function reconcileSubscriptionPaymentFailedWebhook(webhookEvent, dependencies = {}) {
  const { getSubscriptionFn = getPayPalSubscription } = dependencies;
  const localSubscription = await resolveLocalSubscriptionForWebhook(webhookEvent, { getSubscriptionFn });
  const canonical = await getSubscriptionFn(localSubscription.provider_subscription_id);
  const failed = normalizeFailedSaleFromWebhook(
  webhookEvent.resource || {},
  webhookEvent.event_type,
);

  await AppDataSource.transaction(async (manager) => {
    const updatedSubscription = await applyCanonicalSubscriptionState(manager, localSubscription, canonical, {
      source: `webhook:${webhookEvent.event_type}`,
      markSyncedAt: true,
    });

    if (failed.providerPaymentId && failed.grossAmount !== null) {
      const paymentRepository = manager.getRepository(SubscriptionPayment);
      const existing = await paymentRepository.findOne({
        where: { provider_payment_id: failed.providerPaymentId },
      });

      const payload = {
        provider_payment_id: failed.providerPaymentId,
        provider_event_id: normalizeString(webhookEvent.id),
        estado: "FALLIDO",
        moneda: failed.currencyCode,
        monto_bruto: failed.grossAmount,
        monto_fee: 0,
        monto_neto: failed.grossAmount,
        occurred_at: failed.occurredAt ? new Date(failed.occurredAt) : null,
        metadata: {
          reconciled_from: `webhook:${webhookEvent.event_type}`,
        },
      };

      if (existing) {
        await paymentRepository.update(
          { subscription_payment_id: Number(existing.subscription_payment_id) },
          payload,
        );
      } else {
        await paymentRepository.save(paymentRepository.create({
          subscription: { subscription_id: Number(updatedSubscription.subscription_id) },
          ...payload,
        }));
      }
    }
  });

  return buildAdminSubscriptionResponse(localSubscription.subscription_id);
}

function normalizeRefundOrReversalAmount(resource, fallbackAmount) {
  const value = Number(resource?.amount?.total || resource?.amount?.value || fallbackAmount);
  const currencyCode = normalizeCurrency(
    resource?.amount?.currency || resource?.amount?.currency_code || "USD",
  );

  if (!Number.isFinite(value) || value <= 0) {
    throw buildServiceError("El evento PayPal no contiene un monto de ajuste valido.", 409);
  }

  return {
    value: Number(value.toFixed(2)),
    currencyCode,
  };
}

async function createCompensationForSubscriptionPayment(manager, {
  payment,
  adjustmentType,
  eventId,
  amount,
  source,
}) {
  const transactionRepository = manager.getRepository(Transaction);
  const categoryKey = adjustmentType === "REEMBOLSADO"
    ? DONATION_REFUND_CATEGORY_KEY
    : PAYPAL_REVERSAL_CATEGORY_KEY;
  const category = await getTransactionCategoryByKeyOrThrow(manager, categoryKey, { onlyActive: true });
  const provider = await getPaymentProviderByKeyOrThrow(manager, PAYPAL_PROVIDER_KEY, { onlyActive: true });
  const idempotencyKey = adjustmentType === "REEMBOLSADO"
    ? `paypal:subscription-refund:${eventId}`
    : `paypal:subscription-reversal:${eventId}`;

  let transaction = await transactionRepository.findOne({
    where: { idempotencia_key: idempotencyKey },
    relations: {
      category: true,
      payment_provider: true,
      payment_order: true,
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
      subscription_payments: true,
    },
  });

  if (!transaction) {
    transaction = transactionRepository.create({
      tipo: "EGRESO",
      descripcion: adjustmentType === "REEMBOLSADO"
        ? "Refund PayPal de apadrinamiento"
        : "Reversa PayPal de apadrinamiento",
      moneda: amount.currencyCode,
      monto_bruto: amount.value,
      monto_fee: 0,
      monto_neto: amount.value,
      fecha_transaccion: new Date(),
      estado: "CONFIRMADA",
      origen_tipo: adjustmentType === "REEMBOLSADO"
        ? "PAYPAL_SUBSCRIPTION_REFUND"
        : "PAYPAL_SUBSCRIPTION_REVERSAL",
      origen_id: Number(payment.subscription_payment_id),
      referencia_externa: eventId,
      idempotencia_key: idempotencyKey,
      metadata: {
        adjustment_type: adjustmentType,
        original_subscription_payment_id: Number(payment.subscription_payment_id),
        original_transaction_id: payment.transaction?.transaccion_id
          ? Number(payment.transaction.transaccion_id)
          : null,
        provider_payment_id: payment.provider_payment_id,
        provider_subscription_id: payment.subscription?.provider_subscription_id || null,
        reconciled_from: source,
      },
      category: { categoria_transaccion_id: Number(category.categoria_transaccion_id) },
      payment_provider: { proveedor_pago_id: Number(provider.proveedor_pago_id) },
    });
    await transactionRepository.save(transaction);
  }

  return transactionRepository.findOne({
    where: { idempotencia_key: idempotencyKey },
    relations: {
      category: true,
      payment_provider: true,
      payment_order: true,
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
      subscription_payments: true,
    },
  });
}

async function reconcileSubscriptionAdjustment(webhookEvent, adjustmentState, source) {
  const saleId = normalizeString(
    webhookEvent?.resource?.sale_id
    || webhookEvent?.resource?.id,
  );

  if (!saleId) {
    throw buildServiceError("El evento PayPal no incluye el identificador del sale original.", 409);
  }

  return AppDataSource.transaction(async (manager) => {
    const paymentRepository = manager.getRepository(SubscriptionPayment);
    const payment = await paymentRepository.findOne({
      where: { provider_payment_id: saleId },
      relations: {
        subscription: {
          sponsorship: true,
        },
        transaction: {
          category: true,
          payment_provider: true,
          payment_order: true,
          donor: true,
          payable_account: true,
          created_by: true,
          payable_payments: true,
          subscription_payments: true,
        },
      },
    });

    if (!payment) {
      throw buildServiceError("No fue posible localizar el pago recurrente original.", 409);
    }

    const amount = normalizeRefundOrReversalAmount(
      webhookEvent.resource,
      payment.monto_bruto,
    );
    const factId = normalizeString(webhookEvent?.resource?.id) || normalizeString(webhookEvent?.id);
    const transaction = await createCompensationForSubscriptionPayment(manager, {
      payment,
      adjustmentType: adjustmentState,
      eventId: factId,
      amount,
      source,
    });

    await paymentRepository.update(
      { subscription_payment_id: Number(payment.subscription_payment_id) },
      {
        estado: adjustmentState,
        provider_event_id: normalizeString(webhookEvent.id),
        metadata: {
          ...(payment.metadata || {}),
          last_adjustment_event_id: normalizeString(webhookEvent.id),
          last_adjustment_state: adjustmentState,
          last_adjustment_amount: amount.value,
          last_adjustment_currency: amount.currencyCode,
          reconciled_from: source,
        },
      },
    );

    return {
      payment: await paymentRepository.findOne({
        where: { subscription_payment_id: Number(payment.subscription_payment_id) },
        relations: {
          subscription: {
            sponsorship: true,
          },
          transaction: {
            category: true,
            payment_provider: true,
            payment_order: true,
            donor: true,
            payable_account: true,
            created_by: true,
            payable_payments: true,
            subscription_payments: true,
          },
        },
      }),
      transaction,
    };
  });
}

export async function reconcileSubscriptionSaleRefundedWebhook(webhookEvent) {
  return reconcileSubscriptionAdjustment(
    webhookEvent,
    "REEMBOLSADO",
    `webhook:${webhookEvent.event_type}`,
  );
}

export async function reconcileSubscriptionSaleReversedWebhook(webhookEvent) {
  return reconcileSubscriptionAdjustment(
    webhookEvent,
    "REVERSADO",
    `webhook:${webhookEvent.event_type}`,
  );
}

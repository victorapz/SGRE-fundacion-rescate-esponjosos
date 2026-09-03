"use strict";

import crypto from "crypto";
import { ILike, In } from "typeorm";
import { AppDataSource } from "../../config/configDb.js";
import Animal, {
  TipoFechaNacimiento,
} from "../../entities/animalConcept/animal.entity.js";
import AnimalProfile from "../../entities/animalConcept/animal_profile.entity.js";
import FileAsset, {
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../../entities/file_asset.entity.js";
import PaymentProvider from "../../entities/financialConcept/payment_provider.entity.js";
import Sponsor from "../../entities/financialConcept/sponsor.entity.js";
import Sponsorship, {
  SPONSORSHIP_STATUSES,
} from "../../entities/financialConcept/sponsorship.entity.js";
import SponsorshipPlan, {
  SPONSORSHIP_PLAN_CURRENCIES,
  SPONSORSHIP_PLAN_INTERVAL_UNITS,
  SPONSORSHIP_PLAN_MODALITIES,
} from "../../entities/financialConcept/sponsorship_plan.entity.js";
import Subscription, {
  SUBSCRIPTION_STATUSES,
} from "../../entities/financialConcept/subscription.entity.js";
import SubscriptionPayment, {
  SUBSCRIPTION_PAYMENT_STATUSES,
} from "../../entities/financialConcept/subscription_payment.entity.js";
import Transaction from "../../entities/financialConcept/transaction.entity.js";
import {
  buildPagedResult,
  buildPagination,
  getPaymentProviderByKeyOrThrow,
  getTransactionCategoryByKeyOrThrow,
  isUniqueConstraintError,
  mapTransaction,
  normalizeNullableString,
  toIsoTimestamp,
  toNumericNumber,
} from "./accounting.shared.js";

export {
  AppDataSource,
  Animal,
  AnimalProfile,
  FileAsset,
  PaymentProvider,
  Sponsor,
  Sponsorship,
  SponsorshipPlan,
  Subscription,
  SubscriptionPayment,
  Transaction,
  getPaymentProviderByKeyOrThrow,
  getTransactionCategoryByKeyOrThrow,
  isUniqueConstraintError,
  normalizeNullableString,
  toIsoTimestamp,
  toNumericNumber
};

export const PUBLIC_SPONSORSHIP_FILE_CONTEXTS = [
  FILE_ASSET_CONTEXTS.ANIMAL_MAIN,
  FILE_ASSET_CONTEXTS.ANIMAL_GALLERY,
];

export function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

export function normalizeSponsorEmail(email) {
  const normalized = normalizeNullableString(email);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizeStrictBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  throw buildServiceError("El valor booleano enviado no es valido.", 400);
}

export function ensurePositiveAmount(value, label = "El monto") {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw buildServiceError(`${label} debe ser mayor a 0.`, 400);
  }

  return Number(amount.toFixed(2));
}

export function ensureSponsorshipPlanDefaults(payload = {}) {
  const modalidad = String(payload.modalidad || "PAYPAL").trim().toUpperCase();
  const normalizedMode = ensureValidState(
    modalidad,
    SPONSORSHIP_PLAN_MODALITIES,
    "modalidad del plan",
  );

  const defaultsByMode = {
    PAYPAL: {
      moneda: "USD",
      intervalo_unidad: "MONTH",
      intervalo_cantidad: 1,
    },
    MANUAL: {
      moneda: "CLP",
      intervalo_unidad: "MONTH",
      intervalo_cantidad: 1,
    },
  };
  const defaults = defaultsByMode[normalizedMode];

  if ((payload.moneda || defaults.moneda) !== defaults.moneda) {
    throw buildServiceError(
      normalizedMode === "MANUAL"
        ? "Los planes manuales de apadrinamiento solo pueden usar moneda CLP."
        : "Los planes PayPal de apadrinamiento solo pueden usar moneda USD.",
      400,
    );
  }

  if ((payload.intervalo_unidad || defaults.intervalo_unidad) !== defaults.intervalo_unidad) {
    throw buildServiceError("Los planes de apadrinamiento solo admiten frecuencia mensual.", 400);
  }

  if (Number(payload.intervalo_cantidad || defaults.intervalo_cantidad) !== defaults.intervalo_cantidad) {
    throw buildServiceError("Los planes de apadrinamiento solo admiten una frecuencia mensual.", 400);
  }

  return {
    modalidad: normalizedMode,
    moneda: defaults.moneda,
    intervalo_unidad: defaults.intervalo_unidad,
    intervalo_cantidad: defaults.intervalo_cantidad,
  };
}

export function buildPublicFilePreviewUrl(publicId) {
  return publicId ? `/api/public/files/${publicId}/preview` : null;
}

function formatPlanFrequency() {
  return "Mensual";
}

export function inferPlanModalidad(plan) {
  return plan?.modalidad === "MANUAL" ? "MANUAL" : "PAYPAL";
}

export function mapPublicSponsorshipPlan(plan) {
  if (!plan) return null;

  return {
    id: Number(plan.sponsorship_plan_id),
    nombre: plan.nombre || "",
    descripcion: plan.descripcion || null,
    monto: toNumericNumber(plan.monto),
    moneda: plan.moneda || "USD",
    frecuencia: formatPlanFrequency(),
  };
}

export function mapAdminSponsorshipPlan(plan, options = {}) {
  if (!plan) return null;

  const modalidad = inferPlanModalidad(plan);
  const paypalConfigured = Boolean(plan.paypal_product_id && plan.paypal_plan_id);
  const paypalStatus = options.paypalStatus
    || (paypalConfigured ? "CONFIGURADO" : "NO_CONFIGURADO");

  return {
    sponsorship_plan_id: Number(plan.sponsorship_plan_id),
    nombre: plan.nombre || "",
    descripcion: plan.descripcion || null,
    modalidad,
    monto: toNumericNumber(plan.monto),
    moneda: plan.moneda || "USD",
    intervalo_unidad: plan.intervalo_unidad || "MONTH",
    intervalo_cantidad: Number(plan.intervalo_cantidad || 1),
    activo: Boolean(plan.activo),
    orden: Number(plan.orden || 0),
    frecuencia_legible: formatPlanFrequency(),
    has_history: Boolean(options.hasHistory),
    paypal_configurado: paypalConfigured,
    paypal_estado: paypalStatus,
    createdAt: toIsoTimestamp(plan.createdAt),
    updatedAt: toIsoTimestamp(plan.updatedAt),
  };
}

export function mapSponsorAdmin(sponsor, options = {}) {
  if (!sponsor) return null;

  return {
    sponsor_id: Number(sponsor.sponsor_id),
    nombre: sponsor.nombre || "",
    apellido: sponsor.apellido || "",
    email: sponsor.email || "",
    telefono: sponsor.telefono || null,
    consentimiento_datos_at: toIsoTimestamp(sponsor.consentimiento_datos_at),
    activo: Boolean(sponsor.activo),
    sponsorships_count: Number(options.sponsorshipsCount || sponsor.sponsorships?.length || 0),
    active_sponsorships_count: Number(options.activeSponsorshipsCount || 0),
    createdAt: toIsoTimestamp(sponsor.createdAt),
    updatedAt: toIsoTimestamp(sponsor.updatedAt),
  };
}

export function mapAdminAnimalSponsorshipToggle(animal, mainImage = null) {
  if (!animal) return null;

  return {
    id_animal: Number(animal.id_animal),
    nombre: animal.nombre || "",
    especie: animal.especie || "",
    sexo: animal.sexo || "",
    fallecido: Boolean(animal.fallecido),
    apadrinable: Boolean(animal.apadrinable),
    imagen_principal: buildPublicFilePreviewUrl(mainImage?.public_id),
    apadrinamientos_activos: Number(animal.apadrinamientos_activos || 0),
  };
}

function buildApproximateAge(fechaNacimiento) {
  if (!fechaNacimiento) return null;

  const birthDate = new Date(fechaNacimiento);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const now = new Date();
  const totalMonths = Math.max(
    (now.getFullYear() - birthDate.getFullYear()) * 12
      + (now.getMonth() - birthDate.getMonth()),
    0,
  );

  if (totalMonths < 12) {
    return `${Math.max(totalMonths, 1)} mes(es)`;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years} año(s) y ${months} mes(es)` : `${years} año(s)`;
}

function buildPublicProfile(profile) {
  if (!profile) return null;

  return {
    historia: profile.historia || null,
    personalidad: profile.personalidad || null,
    gustos: profile.gustos || null,
    disgustos: profile.disgustos || null,
    cuidados_especiales: profile.cuidados_especiales || null,
  };
}

export function mapPublicSponsorshipAnimalListItem(animal, mainImage = null) {
  if (!animal) return null;

  return {
    id: Number(animal.id_animal),
    nombre: animal.nombre || "",
    especie: animal.especie || "",
    sexo: animal.sexo || "",
    imagen_principal: buildPublicFilePreviewUrl(mainImage?.public_id),
  };
}

export function mapPublicSponsorshipAnimalDetail(
  animal,
  {
    profile = null,
    mainImage = null,
    gallery = [],
    plans = [],
  } = {},
) {
  if (!animal) return null;

  const mainPublicId = mainImage?.public_id || null;
  const galleryUrls = gallery
    .filter((item) => item?.public_id && item.public_id !== mainPublicId)
    .map((item) => buildPublicFilePreviewUrl(item.public_id))
    .filter(Boolean);

  return {
    id: Number(animal.id_animal),
    nombre: animal.nombre || "",
    especie: animal.especie || "",
    sexo: animal.sexo || "",
    fecha_nacimiento: animal.fecha_nacimiento || null,
    edad_aproximada: animal.tipo_fecha_nacimiento === TipoFechaNacimiento.DESCONOCIDA
      ? null
      : buildApproximateAge(animal.fecha_nacimiento),
    perfil_publico: buildPublicProfile(profile),
    imagen_principal: buildPublicFilePreviewUrl(mainImage?.public_id),
    galeria_publica: galleryUrls,
    planes_activos: plans.map(mapPublicSponsorshipPlan),
  };
}

export function mapAdminSponsorship(sponsorship) {
  if (!sponsorship) return null;

  const modalidad = sponsorship.plan?.modalidad
    ? inferPlanModalidad(sponsorship.plan)
    : (
      sponsorship.subscription?.payment_provider?.clave === "MANUAL"
        ? "MANUAL"
        : "PAYPAL"
    );

  return {
    sponsorship_id: Number(sponsorship.sponsorship_id),
    public_reference: sponsorship.public_reference,
    modalidad,
    estado: sponsorship.estado || "",
    solicitado_en: toIsoTimestamp(sponsorship.solicitado_en),
    activado_en: toIsoTimestamp(sponsorship.activado_en),
    cancelado_en: toIsoTimestamp(sponsorship.cancelado_en),
    motivo_cancelacion: sponsorship.motivo_cancelacion || null,
    sponsor: sponsorship.sponsor
      ? {
          sponsor_id: Number(sponsorship.sponsor.sponsor_id),
          nombre: sponsorship.sponsor.nombre || "",
          apellido: sponsorship.sponsor.apellido || "",
          email: sponsorship.sponsor.email || "",
        }
      : null,
    animal: sponsorship.animal
      ? {
          id_animal: Number(sponsorship.animal.id_animal),
          nombre: sponsorship.animal.nombre || "",
          especie: sponsorship.animal.especie || "",
          imagen_principal: sponsorship.animal.imagen_principal || null,
        }
      : null,
    plan: sponsorship.plan
      ? {
          sponsorship_plan_id: Number(sponsorship.plan.sponsorship_plan_id),
          nombre: sponsorship.plan.nombre || "",
          monto: toNumericNumber(sponsorship.plan.monto),
          moneda: sponsorship.plan.moneda || "USD",
        }
      : null,
    subscription: sponsorship.subscription
      ? {
          subscription_id: Number(sponsorship.subscription.subscription_id),
          estado: sponsorship.subscription.estado || "",
          next_billing_time: toIsoTimestamp(sponsorship.subscription.next_billing_time),
          last_synced_at: toIsoTimestamp(sponsorship.subscription.last_synced_at),
          provider_status_updated_at: toIsoTimestamp(sponsorship.subscription.provider_status_updated_at),
          payment_provider: sponsorship.subscription.payment_provider
            ? {
                proveedor_pago_id: Number(sponsorship.subscription.payment_provider.proveedor_pago_id),
                clave: sponsorship.subscription.payment_provider.clave || "",
                nombre: sponsorship.subscription.payment_provider.nombre || "",
                tipo: sponsorship.subscription.payment_provider.tipo || "",
              }
            : null,
        }
      : null,
    createdAt: toIsoTimestamp(sponsorship.createdAt),
    updatedAt: toIsoTimestamp(sponsorship.updatedAt),
  };
}

export function mapAdminSubscription(subscription) {
  if (!subscription) return null;

  return {
    subscription_id: Number(subscription.subscription_id),
    estado: subscription.estado || "",
    approval_url: subscription.approval_url || null,
    payer_email: subscription.payer_email || null,
    provider_subscription_id: subscription.provider_subscription_id || null,
    provider_plan_id: subscription.provider_plan_id || null,
    next_billing_time: toIsoTimestamp(subscription.next_billing_time),
    last_synced_at: toIsoTimestamp(subscription.last_synced_at),
    provider_status_updated_at: toIsoTimestamp(subscription.provider_status_updated_at),
    sponsorship: subscription.sponsorship
      ? mapAdminSponsorship(subscription.sponsorship)
      : null,
    payment_provider: subscription.payment_provider
      ? {
          proveedor_pago_id: Number(subscription.payment_provider.proveedor_pago_id),
          nombre: subscription.payment_provider.nombre || "",
          tipo: subscription.payment_provider.tipo || "",
        }
      : null,
    payments_count: Array.isArray(subscription.payments) ? subscription.payments.length : 0,
    createdAt: toIsoTimestamp(subscription.createdAt),
    updatedAt: toIsoTimestamp(subscription.updatedAt),
  };
}

export function mapAdminSubscriptionPayment(payment) {
  if (!payment) return null;

  return {
    subscription_payment_id: Number(payment.subscription_payment_id),
    estado: payment.estado || "",
    moneda: payment.moneda || "USD",
    monto_bruto: toNumericNumber(payment.monto_bruto),
    monto_fee: toNumericNumber(payment.monto_fee),
    monto_neto: toNumericNumber(payment.monto_neto),
    occurred_at: toIsoTimestamp(payment.occurred_at),
    subscription: payment.subscription
      ? {
          subscription_id: Number(payment.subscription.subscription_id),
          estado: payment.subscription.estado || "",
          sponsorship_id: payment.subscription.sponsorship?.sponsorship_id
            ? Number(payment.subscription.sponsorship.sponsorship_id)
            : null,
          sponsor: payment.subscription.sponsorship?.sponsor
            ? {
                sponsor_id: Number(payment.subscription.sponsorship.sponsor.sponsor_id),
                nombre: payment.subscription.sponsorship.sponsor.nombre || "",
                apellido: payment.subscription.sponsorship.sponsor.apellido || "",
              }
            : null,
          animal: payment.subscription.sponsorship?.animal
            ? {
                id_animal: Number(payment.subscription.sponsorship.animal.id_animal),
                nombre: payment.subscription.sponsorship.animal.nombre || "",
                especie: payment.subscription.sponsorship.animal.especie || "",
              }
            : null,
          plan: payment.subscription.sponsorship?.plan
            ? {
                sponsorship_plan_id: Number(payment.subscription.sponsorship.plan.sponsorship_plan_id),
                nombre: payment.subscription.sponsorship.plan.nombre || "",
                monto: toNumericNumber(payment.subscription.sponsorship.plan.monto),
                moneda: payment.subscription.sponsorship.plan.moneda || "USD",
              }
            : null,
          payment_provider: payment.subscription.payment_provider
            ? {
                proveedor_pago_id: Number(payment.subscription.payment_provider.proveedor_pago_id),
                nombre: payment.subscription.payment_provider.nombre || "",
                tipo: payment.subscription.payment_provider.tipo || "",
                clave: payment.subscription.payment_provider.clave || "",
              }
            : null,
        }
      : null,
    transaction: payment.transaction ? mapTransaction(payment.transaction) : null,
    metodo_manual: normalizeNullableString(payment.metadata?.metodo) || null,
    referencia_manual: normalizeNullableString(payment.metadata?.referencia) || null,
    observacion_manual: normalizeNullableString(payment.metadata?.observacion) || null,
    createdAt: toIsoTimestamp(payment.createdAt),
    updatedAt: toIsoTimestamp(payment.updatedAt),
  };
}

export function buildSearchMatcher(search) {
  const normalized = normalizeNullableString(search);
  return normalized ? ILike(`%${normalized}%`) : null;
}

export function paginateArray(items = [], query = {}) {
  const { page, limit, skip } = buildPagination(query);
  return buildPagedResult(items.slice(skip, skip + limit), items.length, page, limit);
}

export function ensureValidState(value, allowedValues = [], label = "estado") {
  if (!value) return null;

  if (!allowedValues.includes(value)) {
    throw buildServiceError(`El ${label} indicado no es valido.`, 400);
  }

  return value;
}

export function createPublicReference() {
  return crypto.randomUUID();
}

export async function loadPublicAnimalMediaMap(manager, animalIds = []) {
  if (!Array.isArray(animalIds) || animalIds.length === 0) {
    return new Map();
  }

  const repository = manager.getRepository(FileAsset);
  const files = await repository.find({
    where: {
      entity_type: FILE_ASSET_ENTITY_TYPES.ANIMAL,
      entity_id: In(animalIds),
      context: In(PUBLIC_SPONSORSHIP_FILE_CONTEXTS),
      visibility: FILE_ASSET_VISIBILITY.PUBLICO,
      status: FILE_ASSET_STATUS.ACTIVO,
    },
    order: {
      is_main: "DESC",
      sort_order: "ASC",
      uploaded_at: "DESC",
      file_asset_id: "DESC",
    },
  });

  return files.reduce((map, fileAsset) => {
    const entityId = Number(fileAsset.entity_id);
    if (!map.has(entityId)) {
      map.set(entityId, {
        main: null,
        gallery: [],
      });
    }

    const entry = map.get(entityId);
    if (!entry.main && (
      fileAsset.is_main
      || fileAsset.context === FILE_ASSET_CONTEXTS.ANIMAL_MAIN
    )) {
      entry.main = fileAsset;
    }

    entry.gallery.push(fileAsset);
    return map;
  }, new Map());
}

export function isPublicAnimalEligible(animal) {
  return Boolean(animal?.apadrinable) && !Boolean(animal?.fallecido);
}

export function hasPlanHistory(plan) {
  return Array.isArray(plan?.sponsorships) && plan.sponsorships.length > 0;
}

export function hasSponsorHistory(sponsor) {
  return Array.isArray(sponsor?.sponsorships) && sponsor.sponsorships.length > 0;
}

export function countActiveSponsorships(sponsorships = []) {
  if (!Array.isArray(sponsorships)) {
    return 0;
  }

  return sponsorships.filter((item) => ["PENDIENTE_APROBACION", "ACTIVO", "SUSPENDIDO"].includes(item?.estado)).length;
}

export function ensureAllowedSponsorshipState(value) {
  return ensureValidState(value, SPONSORSHIP_STATUSES, "estado del apadrinamiento");
}

export function ensureAllowedSubscriptionState(value) {
  return ensureValidState(value, SUBSCRIPTION_STATUSES, "estado de la suscripcion");
}

export function ensureAllowedSubscriptionPaymentState(value) {
  return ensureValidState(value, SUBSCRIPTION_PAYMENT_STATUSES, "estado del pago recurrente");
}

export function ensureAllowedPlanCurrency(value) {
  return ensureValidState(value, SPONSORSHIP_PLAN_CURRENCIES, "moneda");
}

export function ensureAllowedPlanIntervalUnit(value) {
  return ensureValidState(value, SPONSORSHIP_PLAN_INTERVAL_UNITS, "intervalo");
}

export function ensureAllowedPlanModality(value) {
  return ensureValidState(value, SPONSORSHIP_PLAN_MODALITIES, "modalidad");
}

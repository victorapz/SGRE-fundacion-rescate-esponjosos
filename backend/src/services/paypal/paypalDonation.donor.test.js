"use strict";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AppDataSource } from "../financialConcept/accounting.shared.js";
import {
  createPayPalDonationOrderService,
  mapCaptureOrderPublicResult,
  markPayPalDonationOrderApproved,
  normalizeDonorEmail,
  normalizePayPalPayerIdentity,
  normalizePublicDonorData,
  reconcilePayPalDonationCapture,
  resolveDonationIdentityIntent,
} from "./paypalDonation.service.js";
import { paypalDonationCreateOrderValidation } from "../../validations/paypal/paypalDonation.validation.js";
import Donor from "../../entities/donor.entity.js";

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function getRepositoryKey(target) {
  if (typeof target === "string") return target;
  return target?.options?.name || target?.name || String(target);
}

function getPrimaryKeyForRepository(repositoryKey) {
  switch (repositoryKey) {
    case "Transaction":
      return "transaccion_id";
    case "PaymentOrder":
      return "orden_pago_id";
    case "PaymentProvider":
      return "proveedor_pago_id";
    case "TransactionCategory":
      return "categoria_transaccion_id";
    case "Donor":
      return "donante_id";
    default:
      throw new Error(`No hay PK configurada para ${repositoryKey}.`);
  }
}

function findById(items, primaryKey, value) {
  return items.find((item) => Number(item?.[primaryKey]) === Number(value)) || null;
}

function hydrateEntity(repositoryKey, entity, stores) {
  const hydrated = clone(entity);

  if (!hydrated || typeof hydrated !== "object") {
    return hydrated;
  }

  if (repositoryKey === "PaymentOrder") {
    if (hydrated.payment_provider?.proveedor_pago_id && !hydrated.payment_provider?.clave) {
      hydrated.payment_provider = findById(
        stores.PaymentProvider,
        "proveedor_pago_id",
        hydrated.payment_provider.proveedor_pago_id,
      );
    }
    if (hydrated.donor?.donante_id && !hydrated.donor?.email) {
      hydrated.donor = findById(stores.Donor, "donante_id", hydrated.donor.donante_id);
    }
  }

  if (repositoryKey === "Transaction") {
    if (hydrated.category?.categoria_transaccion_id && !hydrated.category?.clave) {
      hydrated.category = findById(
        stores.TransactionCategory,
        "categoria_transaccion_id",
        hydrated.category.categoria_transaccion_id,
      );
    }
    if (hydrated.payment_provider?.proveedor_pago_id && !hydrated.payment_provider?.clave) {
      hydrated.payment_provider = findById(
        stores.PaymentProvider,
        "proveedor_pago_id",
        hydrated.payment_provider.proveedor_pago_id,
      );
    }
    if (hydrated.payment_order?.orden_pago_id && !hydrated.payment_order?.proveedor_orden_id) {
      hydrated.payment_order = findById(
        stores.PaymentOrder,
        "orden_pago_id",
        hydrated.payment_order.orden_pago_id,
      );
    }
    if (hydrated.donor?.donante_id && !hydrated.donor?.email) {
      hydrated.donor = findById(stores.Donor, "donante_id", hydrated.donor.donante_id);
    }
  }

  return hydrated;
}

function matchesWhere(record, where) {
  if (!where) return true;

  if (Array.isArray(where)) {
    return where.some((item) => matchesWhere(record, item));
  }

  return Object.entries(where).every(([key, expectedValue]) => {
    const currentValue = record?.[key];

    if (
      expectedValue
      && typeof expectedValue === "object"
      && !Array.isArray(expectedValue)
      && !(expectedValue instanceof Date)
      && !expectedValue._type
    ) {
      return matchesWhere(currentValue, expectedValue);
    }

    return currentValue === expectedValue;
  });
}

class FakeRepository {
  constructor(repositoryKey, stores, saveBehaviors = {}) {
    this.repositoryKey = repositoryKey;
    this.stores = stores;
    this.items = stores[repositoryKey];
    this.saveBehaviors = saveBehaviors;
    this.primaryKey = getPrimaryKeyForRepository(repositoryKey);
    this.sequence = this.items.reduce(
      (maxId, item) => Math.max(maxId, Number(item?.[this.primaryKey] || 0)),
      0,
    );
  }

  create(entity) {
    return hydrateEntity(this.repositoryKey, entity, this.stores);
  }

  async findOne({ where } = {}) {
    const matched = [...this.items].reverse().find((item) => matchesWhere(item, where));
    return clone(matched || null);
  }

  async find({ where } = {}) {
    return clone(this.items.filter((item) => matchesWhere(item, where)));
  }

  async update(where, partialEntity) {
    const index = this.items.findIndex((item) => matchesWhere(item, where));

    if (index < 0) {
      return { affected: 0 };
    }

    this.items[index] = clone({
      ...this.items[index],
      ...(partialEntity || {}),
    });

    return { affected: 1 };
  }

  upsert(entity) {
    const hydrated = hydrateEntity(this.repositoryKey, entity, this.stores);

    if (!hydrated?.[this.primaryKey]) {
      this.sequence += 1;
      hydrated[this.primaryKey] = this.sequence;
    }

    const existingIndex = this.items.findIndex(
      (item) => Number(item?.[this.primaryKey]) === Number(hydrated?.[this.primaryKey]),
    );

    if (existingIndex >= 0) {
      this.items[existingIndex] = clone({
        ...this.items[existingIndex],
        ...hydrated,
      });
      return clone(this.items[existingIndex]);
    }

    this.items.push(clone(hydrated));
    return clone(hydrated);
  }

  async save(entity) {
    const saveBehavior = this.saveBehaviors?.[this.repositoryKey];

    if (typeof saveBehavior === "function") {
      const customResult = await saveBehavior(entity, {
        upsert: (value) => this.upsert(value),
        items: this.items,
        stores: this.stores,
        repositoryKey: this.repositoryKey,
        primaryKey: this.primaryKey,
      });

      if (customResult !== undefined) {
        return clone(customResult);
      }
    }

    return this.upsert(entity);
  }
}

async function withFakeAccountingContext({ stores, saveBehaviors = {} }, callback) {
  const originalManager = AppDataSource.manager;
  const originalTransaction = AppDataSource.transaction;
  const repositories = new Map();

  const manager = {
    getRepository(target) {
      const repositoryKey = getRepositoryKey(target);

      if (!repositories.has(repositoryKey)) {
        repositories.set(
          repositoryKey,
          new FakeRepository(repositoryKey, stores, saveBehaviors),
        );
      }

      return repositories.get(repositoryKey);
    },
  };

  AppDataSource.manager = manager;
  AppDataSource.transaction = async (transactionCallback) => transactionCallback(manager);

  try {
    return await callback({ stores, manager });
  } finally {
    AppDataSource.manager = originalManager;
    AppDataSource.transaction = originalTransaction;
  }
}

function buildPayPalProvider() {
  return {
    proveedor_pago_id: 1,
    clave: "PAYPAL",
    nombre: "PayPal",
    tipo: "PAYPAL",
    activo: true,
    metadata_publica: null,
  };
}

function buildCategories() {
  return [
    {
      categoria_transaccion_id: 10,
      clave: "DONACION_UNICA",
      nombre: "Donacion unica",
      tipo: "INGRESO",
      activo: true,
    },
    {
      categoria_transaccion_id: 11,
      clave: "DEVOLUCION_DONACION",
      nombre: "Devolucion donacion",
      tipo: "EGRESO",
      activo: true,
    },
    {
      categoria_transaccion_id: 12,
      clave: "REVERSA_PAYPAL",
      nombre: "Reversa PayPal",
      tipo: "EGRESO",
      activo: true,
    },
  ];
}

function buildStores() {
  return {
    PaymentProvider: [buildPayPalProvider()],
    TransactionCategory: buildCategories(),
    PaymentOrder: [],
    Transaction: [],
    Donor: [],
  };
}

function buildStubPayPalOrder(orderId = "ORDER-IDENTITY-1") {
  return {
    id: orderId,
    status: "CREATED",
    links: [
      {
        rel: "approve",
        href: `https://paypal.test/checkout/${orderId}`,
        method: "GET",
      },
    ],
  };
}

function buildCanonicalCapture({
  captureId = "CAPTURE-IDENTITY-1",
  orderId = "ORDER-IDENTITY-1",
  amount = "10.00",
  feeAmount = "0.59",
  netAmount = "9.41",
  currencyCode = "USD",
  status = "COMPLETED",
  includePayer = true,
  payerEmail = "SB-MIZ2E51437309@PERSONAL.EXAMPLE.COM",
  payerName = "John",
  payerSurname = "Doe",
} = {}) {
  return {
    id: captureId,
    status,
    ...(includePayer
      ? {
          payer: {
            email_address: payerEmail,
            name: {
              given_name: payerName,
              surname: payerSurname,
            },
          },
        }
      : {}),
    amount: {
      currency_code: currencyCode,
      value: amount,
    },
    seller_receivable_breakdown: {
      gross_amount: {
        currency_code: currencyCode,
        value: amount,
      },
      paypal_fee: {
        currency_code: currencyCode,
        value: feeAmount,
      },
      net_amount: {
        currency_code: currencyCode,
        value: netAmount,
      },
    },
    supplementary_data: {
      related_ids: {
        order_id: orderId,
      },
    },
    create_time: "2026-06-18T10:00:00Z",
    update_time: "2026-06-18T10:01:00Z",
  };
}

function buildApprovedPayPalOrder({
  orderId = "ORDER-IDENTITY-1",
  payerEmail = "SB-MIZ2E51437309@PERSONAL.EXAMPLE.COM",
  payerName = "John",
  payerSurname = "Doe",
} = {}) {
  return {
    id: orderId,
    status: "APPROVED",
    payer: {
      email_address: payerEmail,
      name: {
        given_name: payerName,
        surname: payerSurname,
      },
    },
  };
}

function buildCreateOrderBody(overrides = {}) {
  return {
    monto_bruto: 10,
    moneda: "USD",
    descripcion: "Donacion identity test",
    anonymous: false,
    ...overrides,
  };
}

async function createOrderForTest(stores, body, options = {}) {
  return withFakeAccountingContext({ stores, saveBehaviors: options.saveBehaviors || {} }, async () =>
    createPayPalDonationOrderService(body, {
      createOrder: async () => buildStubPayPalOrder(options.paypalOrderId || "ORDER-IDENTITY-1"),
    }));
}

test("normalizeDonorEmail normaliza trim y lowercase", () => {
  assert.equal(normalizeDonorEmail("  Persona@Correo.CL "), "persona@correo.cl");
});

test("normalizeDonorEmail rechaza email invalido", () => {
  assert.throws(
    () => normalizeDonorEmail("correo-invalido"),
    (error) => {
      assert.match(error?.message || "", /email del donante/i);
      return true;
    },
  );
});

test("normalizePublicDonorData ignora propiedades desconocidas", () => {
  const donor = normalizePublicDonorData({
    nombre: "Prueba",
    email: "prueba@example.com",
    telefono: "+56911111111",
    rol: "admin",
  });

  assert.equal(donor.rol, undefined);
});

test("normalizePayPalPayerIdentity normaliza nombre, apellido y email del payer", () => {
  const payer = normalizePayPalPayerIdentity(buildCanonicalCapture({
    payerEmail: " SB-MIZ2E51437309@PERSONAL.EXAMPLE.COM ",
    payerName: " John ",
    payerSurname: " Doe ",
  }));

  assert.deepEqual(payer, {
    nombre: "John",
    apellido: "Doe",
    email: "sb-miz2e51437309@personal.example.com",
  });
});

test("resolveDonationIdentityIntent marca IDENTIFIED para orden publica no anonima", () => {
  const identity = resolveDonationIdentityIntent({
    anonymous: false,
    donor: null,
  });

  assert.equal(identity.identityMode, "IDENTIFIED");
  assert.equal(identity.linkStatus, "PENDING");
  assert.equal(identity.donorPublicData, null);
});

test("paypalDonationCreateOrderValidation rechaza anonymous=true junto con donor", () => {
  const { error } = paypalDonationCreateOrderValidation.validate({
    monto_bruto: 10,
    moneda: "USD",
    anonymous: true,
    donor: {
      nombre: "Prueba",
      email: "prueba@example.com",
      telefono: "+56912345678",
    },
  });

  assert.match(error?.message || "", /anonymous=true/i);
});

test("paypalDonationCreateOrderValidation acepta anonymous booleano real y default false", () => {
  const { error: anonymousTrueError, value: anonymousTrueValue } = paypalDonationCreateOrderValidation.validate({
    monto_bruto: 10,
    moneda: "USD",
    anonymous: true,
  });
  const { error: omittedError, value: omittedValue } = paypalDonationCreateOrderValidation.validate({
    monto_bruto: 10,
    moneda: "USD",
  });

  assert.equal(anonymousTrueError, undefined);
  assert.equal(anonymousTrueValue.anonymous, true);
  assert.equal(omittedError, undefined);
  assert.equal(omittedValue.anonymous, false);
});

test("paypalDonationCreateOrderValidation rechaza coercion implicita en anonymous", () => {
  const invalidAnonymousValues = ["true", "false", 1, 0, "1", "0", null, [], {}];

  for (const anonymous of invalidAnonymousValues) {
    const { error } = paypalDonationCreateOrderValidation.validate({
      monto_bruto: 10,
      moneda: "USD",
      anonymous,
    });

    assert.match(error?.message || "", /anonymous debe ser un valor booleano/i);
  }
});

test("mapCaptureOrderPublicResult calcula donor_linked solo desde relaciones persistidas", () => {
  const mismatchedMetadata = {
    donor_link_status: "LINKED",
  };

  assert.equal(mapCaptureOrderPublicResult({
    orden_pago: { metadata: mismatchedMetadata, donor: null },
    transaccion: { donor: null },
  }).donor_linked, false);

  assert.equal(mapCaptureOrderPublicResult({
    orden_pago: { metadata: mismatchedMetadata, donor: { donante_id: 1 } },
    transaccion: { donor: null },
  }).donor_linked, false);

  assert.equal(mapCaptureOrderPublicResult({
    orden_pago: { metadata: mismatchedMetadata, donor: null },
    transaccion: { donor: { donante_id: 1 } },
  }).donor_linked, false);

  assert.equal(mapCaptureOrderPublicResult({
    orden_pago: { metadata: mismatchedMetadata, donor: { donante_id: 1 } },
    transaccion: { donor: { donante_id: 1 } },
  }).donor_linked, true);

  assert.equal(mapCaptureOrderPublicResult({
    orden_pago: { metadata: mismatchedMetadata, donor: { donante_id: 1 } },
    transaccion: { donor: { donante_id: 2 } },
  }).donor_linked, false);
});

test("create-order minimo sigue siendo valido y no crea Donor", async () => {
  const stores = buildStores();
  const [result, error] = await createOrderForTest(stores, buildCreateOrderBody());

  assert.equal(error, null);
  assert.equal(result.anonymous, false);
  assert.equal(result.donor_linked, false);
  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder.length, 1);
  assert.equal(stores.PaymentOrder[0].donor, null);
  assert.equal(stores.PaymentOrder[0].metadata.donor_identity_mode, "IDENTIFIED");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "PENDING");
  assert.equal(stores.PaymentOrder[0].metadata.donor_public_data, undefined);
});

test("create-order anonimo no persiste donor_public_data", async () => {
  const stores = buildStores();
  const [result, error] = await createOrderForTest(stores, {
    monto_bruto: 10,
    moneda: "USD",
    descripcion: "Donacion anonima",
    anonymous: true,
  }, {
    paypalOrderId: "ORDER-ANON-1",
  });

  assert.equal(error, null);
  assert.equal(result.anonymous, true);
  assert.equal(stores.PaymentOrder[0].metadata.donor_identity_mode, "ANONYMOUS");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "NOT_APPLICABLE");
  assert.equal(stores.PaymentOrder[0].metadata.donor_public_data, undefined);
});

test("create-order puede recibir donor complementario sin exigir telefono ni consentimiento", async () => {
  const stores = buildStores();
  const [result, error] = await createOrderForTest(stores, buildCreateOrderBody({
    donor: {
      nombre: "Formulario",
      apellido: "Publico",
      email: "frontend@example.com",
    },
  }), {
    paypalOrderId: "ORDER-WITH-DONOR-1",
  });

  assert.equal(error, null);
  assert.equal(result.donor_linked, false);
  assert.equal(stores.PaymentOrder[0].metadata.donor_public_data, undefined);
});

test("la entidad Donor permite apellido opcional y mantiene email unico cuando existe", () => {
  assert.equal(Donor.options.tableName, "Donors");
  assert.equal(Donor.options.columns.donante_id.primary, true);
  assert.equal(Donor.options.columns.nombre.nullable, false);
  assert.equal(Donor.options.columns.apellido.nullable, true);
  assert.equal(Donor.options.columns.email.nullable, true);
  assert.equal(Donor.options.columns.email.unique, true);
  assert.equal(Donor.options.columns.telefono.nullable, true);
  assert.equal(Boolean(Donor.options.columns.telefono.unique), false);
});

test("CHECKOUT.ORDER.APPROVED firmado persiste snapshot confiable sin crear Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-APPROVED-SNAPSHOT-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await markPayPalDonationOrderApproved({
      paypalOrderId: "ORDER-APPROVED-SNAPSHOT-1",
      payer: buildApprovedPayPalOrder({
        orderId: "ORDER-APPROVED-SNAPSHOT-1",
      }).payer,
      source: "webhook:CHECKOUT.ORDER.APPROVED",
    });
  });

  assert.equal(stores.Donor.length, 0);
  assert.deepEqual(stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot, {
    nombre: "John",
    apellido: "Doe",
    email: "sb-miz2e51437309@personal.example.com",
  });
  assert.equal(
    stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot_source,
    "VERIFIED_CHECKOUT_ORDER_APPROVED",
  );
  assert.equal(
    stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot_order_id,
    "ORDER-APPROVED-SNAPSHOT-1",
  );
});

test("CHECKOUT.ORDER.APPROVED con payer null no sobrescribe un snapshot valido", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-APPROVED-PRESERVE-1",
  });
  stores.PaymentOrder[0].metadata.paypal = {
    paypal_payer_snapshot: {
      nombre: "Jane",
      apellido: "Existing",
      email: "jane@example.com",
    },
    paypal_payer_snapshot_source: "PAYPAL_ORDER",
    paypal_payer_snapshot_order_id: "ORDER-APPROVED-PRESERVE-1",
    paypal_payer_snapshot_capture_id: null,
    paypal_payer_snapshot_recorded_at: "2026-06-19T10:00:00.000Z",
  };

  await withFakeAccountingContext({ stores }, async () => {
    await markPayPalDonationOrderApproved({
      paypalOrderId: "ORDER-APPROVED-PRESERVE-1",
      payer: null,
      source: "webhook:CHECKOUT.ORDER.APPROVED",
    });
  });

  assert.deepEqual(stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot, {
    nombre: "Jane",
    apellido: "Existing",
    email: "jane@example.com",
  });
  assert.equal(stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot_source, "PAYPAL_ORDER");
});

test("capture COMPLETED sin payer reutiliza snapshot confiable de APPROVED", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-APPROVED-REUSE-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await markPayPalDonationOrderApproved({
      paypalOrderId: "ORDER-APPROVED-REUSE-1",
      payer: buildApprovedPayPalOrder({
        orderId: "ORDER-APPROVED-REUSE-1",
      }).payer,
      source: "webhook:CHECKOUT.ORDER.APPROVED",
    });

    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-APPROVED-REUSE-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-APPROVED-REUSE-1",
        captureId: "CAPTURE-APPROVED-REUSE-1",
        includePayer: false,
      }),
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, stores.Transaction[0].donor.donante_id);
});

test("captura COMPLETED crea Donor desde payer canonico y lo asocia a PaymentOrder y Transaction", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:capture-identified",
    });

    assert.equal(result.orden_pago.donor.email, "sb-miz2e51437309@personal.example.com");
    assert.equal(result.transaccion.donor.email, "sb-miz2e51437309@personal.example.com");
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, stores.Donor[0].donante_id);
  assert.equal(stores.Transaction[0].donor.donante_id, stores.Donor[0].donante_id);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
  assert.equal(stores.PaymentOrder[0].metadata.donor_public_data, undefined);
  assert.equal(stores.PaymentOrder[0].metadata.donor_identity_source, "PAYPAL_PAYER");
  assert.equal(stores.Donor[0].nombre, "John");
  assert.equal(stores.Donor[0].apellido, "Doe");
  assert.equal(stores.Donor[0].email, "sb-miz2e51437309@personal.example.com");
  assert.equal(stores.Donor[0].telefono, null);
});

test("capture-order repara el caso real cuando capture no trae payer pero la orden PayPal si", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-REAL-REPAIR-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-REAL-REPAIR-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-REAL-REPAIR-1",
        captureId: "CAPTURE-REAL-REPAIR-1",
        includePayer: false,
      }),
      payer: {
        nombre: "John",
        apellido: "Doe",
        email: "sb-miz2e51437309@personal.example.com",
      },
      source: "capture-order",
    });

    assert.equal(result.orden_pago.donor.email, "sb-miz2e51437309@personal.example.com");
    assert.equal(result.transaccion.donor.email, "sb-miz2e51437309@personal.example.com");
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(
    stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot.email,
    "sb-miz2e51437309@personal.example.com",
  );
  assert.equal(stores.PaymentOrder[0].metadata.paypal.paypal_payer_snapshot_source, "PAYPAL_ORDER");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
  assert.equal(stores.PaymentOrder[0].donor.donante_id, stores.Transaction[0].donor.donante_id);
});

test("webhook-first crea Donor aunque capture canonico no traiga payer usando la orden PayPal", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-WEBHOOK-FALLBACK-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-WEBHOOK-FALLBACK-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-WEBHOOK-FALLBACK-1",
        captureId: "CAPTURE-WEBHOOK-FALLBACK-1",
        includePayer: false,
      }),
      getCanonicalOrder: async (orderId) => buildApprovedPayPalOrder({ orderId }),
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
  assert.equal(stores.PaymentOrder[0].donor.donante_id, stores.Transaction[0].donor.donante_id);
});

test("snapshot legacy sin source no se reutiliza y obliga a consultar PayPal order", async () => {
  const stores = buildStores();
  let getCanonicalOrderCalls = 0;

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-LEGACY-SNAPSHOT-1",
  });
  stores.PaymentOrder[0].metadata.paypal = {
    payer: {
      nombre: "Legacy",
      apellido: "Unsafe",
      email: "legacy@example.com",
    },
  };

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-LEGACY-SNAPSHOT-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-LEGACY-SNAPSHOT-1",
        captureId: "CAPTURE-LEGACY-SNAPSHOT-1",
        includePayer: false,
      }),
      getCanonicalOrder: async (orderId) => {
        getCanonicalOrderCalls += 1;
        return buildApprovedPayPalOrder({ orderId });
      },
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });
  });

  assert.equal(getCanonicalOrderCalls, 1);
  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Donor[0].email, "sb-miz2e51437309@personal.example.com");
});

test("snapshot confiable de otra order no se reutiliza para una captura distinta", async () => {
  const stores = buildStores();
  let getCanonicalOrderCalls = 0;

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-SNAPSHOT-MISMATCH-1",
  });
  stores.PaymentOrder[0].metadata.paypal = {
    paypal_payer_snapshot: {
      nombre: "Wrong",
      apellido: "Order",
      email: "wrong-order@example.com",
    },
    paypal_payer_snapshot_source: "PAYPAL_ORDER",
    paypal_payer_snapshot_order_id: "ORDER-OTHER-999",
    paypal_payer_snapshot_capture_id: null,
    paypal_payer_snapshot_recorded_at: "2026-06-19T10:00:00.000Z",
  };

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-SNAPSHOT-MISMATCH-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-SNAPSHOT-MISMATCH-1",
        captureId: "CAPTURE-SNAPSHOT-MISMATCH-1",
        includePayer: false,
      }),
      getCanonicalOrder: async (orderId) => {
        getCanonicalOrderCalls += 1;
        return buildApprovedPayPalOrder({ orderId });
      },
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });
  });

  assert.equal(getCanonicalOrderCalls, 1);
  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Donor[0].email, "sb-miz2e51437309@personal.example.com");
});

test("correo repetido reutiliza el mismo Donor normalizado", async () => {
  const stores = buildStores();
  stores.Donor.push({
    donante_id: 7,
    nombre: "Prueba Existente",
    apellido: "Existente",
    email: "sb-miz2e51437309@personal.example.com",
    telefono: null,
    usuario_instagram: null,
  });

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:reuse-donor",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, 7);
  assert.equal(stores.Transaction[0].donor.donante_id, 7);
});

test("no deduplica por nombre si cambia el email", async () => {
  const stores = buildStores();
  stores.Donor.push({
    donante_id: 1,
    nombre: "John",
    apellido: "Doe",
    email: "otro@example.com",
    telefono: null,
    usuario_instagram: null,
  });

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture({
        payerEmail: "nuevo@example.com",
      }),
      source: "test:new-donor-by-email",
    });
  });

  assert.equal(stores.Donor.length, 2);
});

test("payer PayPal reutiliza email canonico aunque exista donor_public_data legacy distinto", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody());
  stores.PaymentOrder[0].metadata.donor_public_data = {
    nombre: "Legacy",
    apellido: "Formulario",
    email: "legacy@example.com",
    telefono: "+56999999999",
  };

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:payer-does-not-replace-donor",
    });
  });

  assert.equal(stores.Donor[0].email, "sb-miz2e51437309@personal.example.com");
});

test("replay no crea otro Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:first-capture",
    });

    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:replay-capture",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Transaction.length, 1);
});

test("rama idempotente repara una relacion faltante sin crear otra Transaction ni otro Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-REPAIR-LINK-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-REPAIR-LINK-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-REPAIR-LINK-1",
        captureId: "CAPTURE-REPAIR-LINK-1",
      }),
      source: "test:first-link",
    });
  });

  stores.PaymentOrder[0].donor = null;
  stores.PaymentOrder[0].metadata.donor_link_status = "ERROR";

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-REPAIR-LINK-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-REPAIR-LINK-1",
        captureId: "CAPTURE-REPAIR-LINK-1",
        includePayer: false,
      }),
      source: "test:repair-missing-order-link",
    });

    assert.equal(result.orden_pago.donor.donante_id, result.transaccion.donor.donante_id);
  });

  assert.equal(stores.Transaction.length, 1);
  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, stores.Transaction[0].donor.donante_id);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
});

test("webhook-first asocia Donor y capture-order posterior no lo duplica", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });

    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "capture-order",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Transaction.length, 1);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
});

test("capture-order-first asocia Donor y webhook posterior no lo duplica", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "capture-order",
    });

    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "webhook:PAYMENT.CAPTURE.COMPLETED",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Transaction.length, 1);
});

test("donacion anonima confirmada no crea Donor ni rompe con payer PayPal", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, {
    monto_bruto: 10,
    moneda: "USD",
    anonymous: true,
  }, {
    paypalOrderId: "ORDER-ANON-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-ANON-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-ANON-1",
        captureId: "CAPTURE-ANON-1",
      }),
      payer: {
        email: "paypal-anon@example.com",
      },
      source: "test:anonymous-capture",
    });

    assert.equal(result.orden_pago.donor, null);
    assert.equal(result.transaccion.donor, null);
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "NOT_APPLICABLE");
  assert.equal(stores.PaymentOrder[0].metadata.donor_public_data, undefined);
});

test("payer sin email no crea Donor y deja estado reparable", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-MISSING-EMAIL-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-MISSING-EMAIL-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-MISSING-EMAIL-1",
        captureId: "CAPTURE-MISSING-EMAIL-1",
        payerEmail: null,
      }),
      getCanonicalOrder: async (orderId) => buildApprovedPayPalOrder({
        orderId,
        payerEmail: null,
      }),
      source: "test:missing-payer-email",
    });
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].estado, "CAPTURADA");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "MISSING_PAYER_EMAIL");
});

test("payer sin nombre no crea Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-MISSING-NAME-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-MISSING-NAME-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-MISSING-NAME-1",
        captureId: "CAPTURE-MISSING-NAME-1",
        payerName: null,
      }),
      getCanonicalOrder: async (orderId) => buildApprovedPayPalOrder({
        orderId,
        payerName: null,
      }),
      source: "test:missing-payer-name",
    });
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "MISSING_PAYER_NAME");
});

test("payer sin apellido no crea Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-MISSING-SURNAME-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-MISSING-SURNAME-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-MISSING-SURNAME-1",
        captureId: "CAPTURE-MISSING-SURNAME-1",
        payerSurname: null,
      }),
      getCanonicalOrder: async (orderId) => buildApprovedPayPalOrder({
        orderId,
        payerSurname: null,
      }),
      source: "test:missing-payer-surname",
    });
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "MISSING_PAYER_SURNAME");
});

test("payer con apellido vacio o espacios no crea Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-BLANK-SURNAME-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-BLANK-SURNAME-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-BLANK-SURNAME-1",
        captureId: "CAPTURE-BLANK-SURNAME-1",
        payerSurname: "   ",
      }),
      getCanonicalOrder: async (orderId) => buildApprovedPayPalOrder({
        orderId,
        payerSurname: "   ",
      }),
      source: "test:blank-payer-surname",
    });
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "MISSING_PAYER_SURNAME");
});

test("captura PENDING no crea Donor", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-PENDING-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationCapture({
        paypalOrderId: "ORDER-PENDING-1",
        capture: buildCanonicalCapture({
          orderId: "ORDER-PENDING-1",
          captureId: "CAPTURE-PENDING-1",
          status: "PENDING",
        }),
        source: "test:pending-capture",
      }),
      (error) => {
        assert.match(error?.message || "", /no fue completada/i);
        return true;
      },
    );
  });

  assert.equal(stores.Donor.length, 0);
});

test("email canonico con distinto casing reutiliza el mismo Donor", async () => {
  const stores = buildStores();
  stores.Donor.push({
    donante_id: 77,
    nombre: "John",
    apellido: "Doe",
    email: "sb-miz2e51437309@personal.example.com",
    telefono: null,
    usuario_instagram: null,
  });

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-CASE-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-CASE-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-CASE-1",
        captureId: "CAPTURE-CASE-1",
        payerEmail: "SB-MIZ2E51437309@PERSONAL.EXAMPLE.COM",
      }),
      source: "test:case-insensitive-email",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, 77);
});

test("Donor existente conserva su apellido interno aunque PayPal entregue otro", async () => {
  const stores = buildStores();
  stores.Donor.push({
    donante_id: 88,
    nombre: "John",
    apellido: "Apellido Interno",
    email: "sb-miz2e51437309@personal.example.com",
    telefono: null,
    usuario_instagram: null,
  });

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-KEEP-SURNAME-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-KEEP-SURNAME-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-KEEP-SURNAME-1",
        captureId: "CAPTURE-KEEP-SURNAME-1",
        payerSurname: "Surname PayPal",
      }),
      source: "test:keep-existing-donor-data",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Donor[0].apellido, "Apellido Interno");
  assert.equal(stores.PaymentOrder[0].donor.donante_id, 88);
});

test("Donor historico con mismo email pero sin apellido queda pendiente y no se asocia silenciosamente", async () => {
  const stores = buildStores();
  stores.Donor.push({
    donante_id: 91,
    nombre: "John",
    apellido: null,
    email: "sb-miz2e51437309@personal.example.com",
    telefono: null,
    usuario_instagram: null,
  });

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-HISTORICAL-INCOMPLETE-1",
  });

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-HISTORICAL-INCOMPLETE-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-HISTORICAL-INCOMPLETE-1",
        captureId: "CAPTURE-HISTORICAL-INCOMPLETE-1",
      }),
      source: "test:historical-donor-incomplete",
    });

    assert.equal(result.orden_pago.estado, "CAPTURADA");
    assert.equal(result.transaccion.estado, "CONFIRMADA");
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].donor, null);
  assert.equal(stores.Transaction[0].donor, null);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "ERROR");
  assert.match(
    stores.PaymentOrder[0].metadata.donor_link_error || "",
    /sin apellido/i,
  );
});

test("fallo al crear Donor conserva PaymentOrder CAPTURADA y Transaction CONFIRMADA", async () => {
  const stores = buildStores();
  let donorSaveAttempts = 0;

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Donor() {
        donorSaveAttempts += 1;
        throw new Error("duplicate key value violates unique constraint");
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:donor-save-error",
    });

    assert.equal(result.orden_pago.estado, "CAPTURADA");
    assert.equal(result.transaccion.estado, "CONFIRMADA");
  });

  assert.equal(donorSaveAttempts, 1);
  assert.equal(stores.Transaction.length, 1);
  assert.equal(stores.PaymentOrder[0].estado, "CAPTURADA");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "ERROR");
  assert.equal(stores.PaymentOrder[0].metadata.donor_id, undefined);
  assert.match(
    stores.PaymentOrder[0].metadata.donor_link_error || "",
    /No fue posible asociar el donante/i,
  );
});

test("fallo de esquema historico en Donors queda diagnosticado como DONOR_SCHEMA_CONSTRAINT_MISMATCH", async () => {
  const stores = buildStores();

  await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-SCHEMA-MISMATCH-1",
  });

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Donor() {
        const error = new Error('null value in column "telefono" violates not-null constraint');
        error.code = "23502";
        throw error;
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-SCHEMA-MISMATCH-1",
      capture: buildCanonicalCapture({
        orderId: "ORDER-SCHEMA-MISMATCH-1",
        captureId: "CAPTURE-SCHEMA-MISMATCH-1",
      }),
      source: "test:schema-mismatch",
    });

    assert.equal(result.orden_pago.estado, "CAPTURADA");
    assert.equal(result.transaccion.estado, "CONFIRMADA");
  });

  assert.equal(stores.Donor.length, 0);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "ERROR");
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_error_code, "DONOR_SCHEMA_CONSTRAINT_MISMATCH");
});

test("replay posterior puede reparar una asociacion pendiente de Donor", async () => {
  const stores = buildStores();
  let shouldFail = true;

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Donor(entity, context) {
        if (shouldFail) {
          throw new Error("No fue posible insertar donor.");
        }

        return context.upsert(entity);
      },
    },
  }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:first-fails",
    });
  });

  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "ERROR");
  assert.equal(stores.Donor.length, 0);

  shouldFail = false;

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:replay-recovers",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.PaymentOrder[0].metadata.donor_link_status, "LINKED");
  assert.equal(stores.Transaction[0].donor.donante_id, stores.Donor[0].donante_id);
});

test("23505 al crear Donor recupera el registro fuera de la transaccion abortada", async () => {
  const stores = buildStores();
  let duplicateTriggered = false;

  await createOrderForTest(stores, buildCreateOrderBody());

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Donor(entity, context) {
        if (!duplicateTriggered) {
          duplicateTriggered = true;
          context.upsert({
            ...entity,
            donante_id: 55,
          });
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }

        return context.upsert(entity);
      },
    },
  }, async () => {
    await reconcilePayPalDonationCapture({
      paypalOrderId: "ORDER-IDENTITY-1",
      capture: buildCanonicalCapture(),
      source: "test:donor-23505",
    });
  });

  assert.equal(stores.Donor.length, 1);
  assert.equal(stores.Donor[0].donante_id, 55);
  assert.equal(stores.PaymentOrder[0].donor.donante_id, 55);
  assert.equal(stores.Transaction[0].donor.donante_id, 55);
});

test("respuesta publica de create-order no expone email ni donor completo", async () => {
  const stores = buildStores();
  const [result, error] = await createOrderForTest(stores, buildCreateOrderBody(), {
    paypalOrderId: "ORDER-PUBLIC-1",
  });

  assert.equal(error, null);
  assert.equal("donor" in result, false);
  assert.equal("email" in result, false);
  assert.equal(typeof result.donor_linked, "boolean");
});

test("la migracion donor_apellido_not_null falla si quedan apellidos nulos o vacios y luego aplica NOT NULL", () => {
  const migrationSql = readFileSync(
    new URL("../../migrations/20260618_donor_apellido_not_null.sql", import.meta.url),
    "utf8",
  );

  assert.match(migrationSql, /SELECT[\s\S]*donante_id,[\s\S]*email,[\s\S]*nombre,[\s\S]*apellido/i);
  assert.match(migrationSql, /SET\s+"apellido"\s*=\s*NULLIF\(BTRIM\("apellido"\),\s*''\)/i);
  assert.match(migrationSql, /No se puede aplicar NOT NULL a Donors\.apellido/i);
  assert.match(migrationSql, /ALTER TABLE\s+"Donors"\s+[\s\S]*ALTER COLUMN\s+"apellido"\s+SET NOT NULL/i);
});

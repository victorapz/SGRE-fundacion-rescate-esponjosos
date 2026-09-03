"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { AppDataSource } from "../financialConcept/accounting.shared.js";
import {
  createAdminPayPalDonationRefundService,
  buildPayPalRefundIdempotencyKey,
  buildPayPalReversalIdempotencyKey,
  extractCompletedPayPalCaptureIdFromOrder,
  fromMinorUnits,
  getDonationRefundWindowInfo,
  normalizePayPalCaptureFinancials,
  normalizePayPalRefundFinancials,
  normalizePayPalReversalSnapshot,
  planCaptureTransactionReconciliation,
  reconcilePayPalDonationRefund,
  reconcilePayPalDonationReversal,
  resolveCaptureIdFromPayPalRefund,
  resolveDonationRefundConfirmationDate,
  resolveOrderIdFromPayPalCapture,
  toMinorUnits,
} from "./paypalDonation.service.js";
import { paypalRequest } from "./paypal.service.js";

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
    case "WebhookLog":
      return "webhook_log_id";
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
    ) {
      return matchesWhere(currentValue, expectedValue);
    }

    return currentValue === expectedValue;
  });
}

class FakeRepository {
  constructor(repositoryKey, stores, saveBehaviors, repositoryBehaviors = {}) {
    this.repositoryKey = repositoryKey;
    this.stores = stores;
    this.items = stores[repositoryKey];
    this.saveBehaviors = saveBehaviors;
    this.repositoryBehavior = repositoryBehaviors?.[repositoryKey] || {};
    this.primaryKey = getPrimaryKeyForRepository(repositoryKey);
    this.sequence = this.items.reduce(
      (maxId, item) => Math.max(maxId, Number(item?.[this.primaryKey] || 0)),
      0,
    );

    if (this.repositoryBehavior.disableCreateQueryBuilder) {
      this.createQueryBuilder = undefined;
    }
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
    const existingIndex = this.items.findIndex((item) => matchesWhere(item, where));

    if (existingIndex < 0) {
      return { affected: 0 };
    }

    this.items[existingIndex] = clone({
      ...this.items[existingIndex],
      ...(partialEntity || {}),
    });

    return { affected: 1 };
  }

  upsert(entity) {
    const hydrated = hydrateEntity(this.repositoryKey, entity, this.stores);
    const primaryKeyValue = hydrated?.[this.primaryKey];

    if (!primaryKeyValue) {
      this.sequence += 1;
      hydrated[this.primaryKey] = this.sequence;
    }

    const existingIndex = this.items.findIndex(
      (item) => Number(item?.[this.primaryKey]) === Number(hydrated?.[this.primaryKey]),
    );

    if (existingIndex >= 0) {
      this.items[existingIndex] = clone(hydrated);
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

  createQueryBuilder() {
    const repository = this;
    const behavior = this.repositoryBehavior;
    let lockTransactionId = null;
    let lockMode = null;

    const queryBuilder = {
      setLock() {
        if (behavior.setLockError) {
          throw behavior.setLockError;
        }

        lockMode = arguments[0];
        behavior.onSetLock?.({
          mode: lockMode,
          repository,
          stores: repository.stores,
        });
        return this;
      },
      where(_sql, params) {
        lockTransactionId = params?.transactionId;
        behavior.onWhere?.({
          transactionId: lockTransactionId,
          repository,
          stores: repository.stores,
        });
        return this;
      },
      async getOne() {
        if (behavior.getOneError) {
          throw behavior.getOneError;
        }

        if (typeof behavior.getOneResult === "function") {
          return clone(await behavior.getOneResult({
            transactionId: lockTransactionId,
            lockMode,
            repository,
            stores: repository.stores,
          }));
        }

        return repository.findOne({
          where: {
            transaccion_id: Number(lockTransactionId),
          },
        });
      },
    };

    if (behavior.disableSetLock) {
      delete queryBuilder.setLock;
    }

    if (behavior.disableWhere) {
      delete queryBuilder.where;
    }

    if (behavior.disableGetOne) {
      delete queryBuilder.getOne;
    }

    return queryBuilder;
  }
}

async function withFakeAccountingContext({
  stores,
  saveBehaviors = {},
  repositoryBehaviors = {},
}, callback) {
  const originalManager = AppDataSource.manager;
  const originalTransaction = AppDataSource.transaction;
  const repositories = new Map();

  const manager = {
    getRepository(target) {
      const repositoryKey = getRepositoryKey(target);

      if (!repositories.has(repositoryKey)) {
        repositories.set(
          repositoryKey,
          new FakeRepository(repositoryKey, stores, saveBehaviors, repositoryBehaviors),
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

function buildManualProvider() {
  return {
    proveedor_pago_id: 2,
    clave: "MANUAL",
    nombre: "Manual",
    tipo: "MANUAL",
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

function buildPaymentOrder({
  orderId = 20,
  paypalOrderId = "ORDER-123",
  provider = buildPayPalProvider(),
  grossAmount = 10,
  currencyCode = "USD",
  state = "CAPTURADA",
  captureId = "CAPTURE-123",
  capturedAt = "2026-06-17T12:00:00Z",
  createdAt = "2026-06-17T11:55:00Z",
} = {}) {
  return {
    orden_pago_id: orderId,
    proveedor_orden_id: paypalOrderId,
    proposito: "DONACION_UNICA",
    moneda: currencyCode,
    monto_bruto: grossAmount,
    estado: state,
    approval_url: "https://paypal.test/approve",
    capturada_en: capturedAt,
    metadata: {
      descripcion: "Donacion unica",
      paypal: {
        order_id: paypalOrderId,
        capture_id: captureId,
        update_time: capturedAt,
      },
    },
    payment_provider: provider,
    donor: null,
    transactions: [],
    createdAt,
    updatedAt: capturedAt,
  };
}

function buildOriginalCaptureTransaction({
  paymentOrder,
  provider,
  donationCategory,
  captureId = "CAPTURE-123",
  grossAmount = 10,
  feeAmount = 0.88,
  netAmount = 9.12,
  currencyCode = "USD",
  fechaTransaccion = paymentOrder?.capturada_en || "2026-06-17T12:00:00Z",
} = {}) {
  return {
    transaccion_id: 100,
    tipo: "INGRESO",
    estado: "CONFIRMADA",
    category: donationCategory,
    payment_provider: provider,
    payment_order: paymentOrder,
    donor: null,
    moneda: currencyCode,
    monto_bruto: grossAmount,
    monto_fee: feeAmount,
    monto_neto: netAmount,
    fecha_transaccion: fechaTransaccion,
    referencia_externa: captureId,
    idempotencia_key: `paypal:capture:${captureId}`,
    metadata: {
      paypal_order_id: paymentOrder.proveedor_orden_id,
      paypal_capture_id: captureId,
    },
  };
}

function buildCanonicalRefund({
  refundId = "REFUND-123",
  captureId = "CAPTURE-123",
  orderId = "ORDER-123",
  amount = "3.00",
  feeAmount = "0.00",
  netAmount = null,
  currencyCode = "USD",
  status = "COMPLETED",
  includeRelatedIds = true,
  includeCaptureUpLink = false,
  customId = null,
  includeBreakdown = true,
} = {}) {
  const links = [];
  const resolvedNetAmount = netAmount ?? (Number(amount) - Number(feeAmount)).toFixed(2);

  if (includeCaptureUpLink) {
    links.push({
      rel: "up",
      href: `https://api.sandbox.paypal.com/v2/payments/captures/${captureId}`,
      method: "GET",
    });
  }

  return {
    id: refundId,
    status,
    amount: {
      currency_code: currencyCode,
      value: amount,
    },
    supplementary_data: includeRelatedIds
      ? {
          related_ids: {
            capture_id: captureId,
            order_id: orderId,
          },
        }
      : undefined,
    seller_payable_breakdown: includeBreakdown
      ? {
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
            value: resolvedNetAmount,
          },
          total_refunded_amount: {
            currency_code: currencyCode,
            value: amount,
          },
        }
      : undefined,
    links,
    custom_id: customId,
    create_time: "2026-06-17T12:00:00Z",
    update_time: "2026-06-17T12:01:00Z",
  };
}

function buildCanonicalCapture({
  captureId = "CAPTURE-123",
  orderId = "ORDER-123",
  amount = "10.00",
  currencyCode = "USD",
  status = "COMPLETED",
  includeRelatedIds = true,
  includeOrderUpLink = false,
  customId = null,
} = {}) {
  const links = [];

  if (includeOrderUpLink) {
    links.push({
      rel: "up",
      href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
      method: "GET",
    });
  }

  return {
    id: captureId,
    status,
    amount: {
      currency_code: currencyCode,
      value: amount,
    },
    supplementary_data: includeRelatedIds
      ? {
          related_ids: {
            order_id: orderId,
          },
        }
      : undefined,
    links,
    custom_id: customId,
    seller_receivable_breakdown: {
      gross_amount: {
        currency_code: currencyCode,
        value: amount,
      },
      paypal_fee: {
        currency_code: currencyCode,
        value: "0.88",
      },
      net_amount: {
        currency_code: currencyCode,
        value: "9.12",
      },
    },
    create_time: "2026-06-17T11:58:00Z",
    update_time: "2026-06-17T12:00:00Z",
  };
}

function buildWebhookReversalEvent({
  eventId = "WH-REV-123",
  eventType = "PAYMENT.CAPTURE.REVERSED",
  resourceId = "CAPTURE-123",
  amount = "10.00",
  currencyCode = "USD",
} = {}) {
  return {
    id: eventId,
    event_type: eventType,
    create_time: "2026-06-17T12:05:00Z",
    resource: {
      id: resourceId,
      amount: {
        currency_code: currencyCode,
        value: amount,
      },
    },
  };
}

function buildBaseStores({
  grossAmount = 10,
  currencyCode = "USD",
  extraTransactions = [],
  paymentOrderState = "CAPTURADA",
  captureId = "CAPTURE-123",
  paypalOrderId = "ORDER-123",
} = {}) {
  const paypalProvider = buildPayPalProvider();
  const manualProvider = buildManualProvider();
  const [donationCategory, refundCategory, reversalCategory] = buildCategories();
  const paymentOrder = buildPaymentOrder({
    provider: paypalProvider,
    grossAmount,
    currencyCode,
    state: paymentOrderState,
    paypalOrderId,
    captureId,
  });
  const originalCaptureTransaction = buildOriginalCaptureTransaction({
    paymentOrder,
    provider: paypalProvider,
    donationCategory,
    grossAmount,
    currencyCode,
    captureId,
  });

  return {
    stores: {
      Transaction: [originalCaptureTransaction, ...extraTransactions.map(clone)],
      PaymentOrder: [paymentOrder],
      PaymentProvider: [paypalProvider, manualProvider],
      TransactionCategory: [donationCategory, refundCategory, reversalCategory],
      Donor: [],
      WebhookLog: [],
    },
    fixtures: {
      paypalProvider,
      manualProvider,
      donationCategory,
      refundCategory,
      reversalCategory,
      paymentOrder,
      originalCaptureTransaction,
    },
  };
}

function buildCanonicalCaptureResolver({
  paymentOrder,
  captureId = "CAPTURE-123",
  includeRelatedIds = true,
  includeOrderUpLink = false,
} = {}) {
  return async (resolvedCaptureId) => buildCanonicalCapture({
    captureId: resolvedCaptureId || captureId,
    orderId: paymentOrder?.proveedor_orden_id || "ORDER-123",
    includeRelatedIds,
    includeOrderUpLink,
  });
}

test("resolveDonationRefundConfirmationDate prioriza capturada_en y no usa timestamps mutables posteriores", () => {
  const paymentOrder = buildPaymentOrder({
    capturedAt: "2026-06-17T12:00:00Z",
  });
  paymentOrder.metadata.paypal.update_time = "2026-06-20T09:30:00Z";
  paymentOrder.updatedAt = "2026-06-20T09:30:00Z";

  const captureTransaction = buildOriginalCaptureTransaction({
    paymentOrder,
    fechaTransaccion: "2026-06-17T12:05:00Z",
  });

  const confirmedAt = resolveDonationRefundConfirmationDate(paymentOrder, captureTransaction);

  assert.equal(confirmedAt?.toISOString(), "2026-06-17T12:00:00.000Z");
});

test("getDonationRefundWindowInfo bloquea ordenes sin timestamp confiable aunque updatedAt sea reciente", () => {
  const paymentOrder = buildPaymentOrder({
    capturedAt: null,
  });
  paymentOrder.metadata.paypal.update_time = "2026-06-20T09:30:00Z";
  paymentOrder.updatedAt = "2026-06-20T09:30:00Z";

  const captureTransaction = buildOriginalCaptureTransaction({
    paymentOrder,
    fechaTransaccion: null,
  });

  const refundWindow = getDonationRefundWindowInfo(paymentOrder, captureTransaction, {
    now: new Date("2026-06-20T10:00:00Z"),
  });

  assert.equal(refundWindow.confirmedAt, null);
  assert.equal(refundWindow.availableUntil, null);
  assert.equal(refundWindow.withinWindow, false);
});

test("normalizePayPalCaptureFinancials usa seller_receivable_breakdown como fuente canonica", () => {
  const normalized = normalizePayPalCaptureFinancials({
    id: "CAPTURE-123",
    status: "COMPLETED",
    amount: {
      currency_code: "USD",
      value: "10.00",
    },
    seller_receivable_breakdown: {
      gross_amount: {
        currency_code: "USD",
        value: "10.00",
      },
      paypal_fee: {
        currency_code: "USD",
        value: "0.88",
      },
      net_amount: {
        currency_code: "USD",
        value: "9.12",
      },
    },
    supplementary_data: {
      related_ids: {
        order_id: "ORDER-123",
      },
    },
  });

  assert.deepEqual(normalized, {
    paypalCaptureId: "CAPTURE-123",
    paypalOrderId: "ORDER-123",
    captureStatus: "COMPLETED",
    currencyCode: "USD",
    grossAmount: 10,
    feeAmount: 0.88,
    netAmount: 9.12,
    hasSellerReceivableBreakdown: true,
    financialSource: "seller_receivable_breakdown",
    createTime: null,
    updateTime: null,
  });
});

test("normalizePayPalCaptureFinancials hace fallback seguro cuando falta seller_receivable_breakdown", () => {
  const normalized = normalizePayPalCaptureFinancials({
    id: "CAPTURE-456",
    status: "COMPLETED",
    amount: {
      currency_code: "USD",
      value: "15.50",
    },
  });

  assert.equal(normalized.grossAmount, 15.5);
  assert.equal(normalized.feeAmount, 0);
  assert.equal(normalized.netAmount, 15.5);
  assert.equal(normalized.financialSource, "capture_amount_fallback");
  assert.equal(normalized.hasSellerReceivableBreakdown, false);
});

test("normalizePayPalCaptureFinancials rechaza monedas inconsistentes", () => {
  assert.throws(
    () => normalizePayPalCaptureFinancials({
      id: "CAPTURE-789",
      status: "COMPLETED",
      amount: {
        currency_code: "USD",
        value: "10.00",
      },
      seller_receivable_breakdown: {
        gross_amount: {
          currency_code: "USD",
          value: "10.00",
        },
        paypal_fee: {
          currency_code: "EUR",
          value: "0.50",
        },
        net_amount: {
          currency_code: "USD",
          value: "9.50",
        },
      },
    }),
    /monedas inconsistentes/i,
  );
});

test("normalizePayPalCaptureFinancials rechaza arithmetic mismatch en gross-fee-net", () => {
  assert.throws(
    () => normalizePayPalCaptureFinancials({
      id: "CAPTURE-790",
      status: "COMPLETED",
      amount: {
        currency_code: "USD",
        value: "10.00",
      },
      seller_receivable_breakdown: {
        gross_amount: {
          currency_code: "USD",
          value: "10.00",
        },
        paypal_fee: {
          currency_code: "USD",
          value: "0.80",
        },
        net_amount: {
          currency_code: "USD",
          value: "9.50",
        },
      },
    }),
    /gross_amount - paypal_fee no coincide/i,
  );
});

test("extractCompletedPayPalCaptureIdFromOrder prioriza la captura COMPLETED", () => {
  const captureId = extractCompletedPayPalCaptureIdFromOrder({
    purchase_units: [
      {
        payments: {
          captures: [
            { id: "CAPTURE-PENDING", status: "PENDING" },
            { id: "CAPTURE-COMPLETED", status: "COMPLETED" },
          ],
        },
      },
    ],
  });

  assert.equal(captureId, "CAPTURE-COMPLETED");
});

test("planCaptureTransactionReconciliation detecta enriquecimiento legacy fee=0 net=gross", () => {
  const plan = planCaptureTransactionReconciliation({
    monto_bruto: 10,
    monto_fee: 0,
    monto_neto: 10,
    moneda: "USD",
    referencia_externa: "CAPTURE-123",
    metadata: {
      paypal_order_id: "ORDER-123",
    },
    payment_order: {
      orden_pago_id: 77,
    },
  }, {
    paymentOrderId: 77,
    paypalOrderId: "ORDER-123",
    captureFinancials: {
      paypalCaptureId: "CAPTURE-123",
      grossAmount: 10,
      feeAmount: 0.88,
      netAmount: 9.12,
      currencyCode: "USD",
      hasSellerReceivableBreakdown: true,
    },
  });

  assert.equal(plan.requiresEnrichment, true);
});

test("planCaptureTransactionReconciliation rechaza conflictos severos de monto", () => {
  let thrown = null;

  try {
    planCaptureTransactionReconciliation({
      monto_bruto: 12,
      monto_fee: 0,
      monto_neto: 12,
      moneda: "USD",
      referencia_externa: "CAPTURE-123",
      payment_order: {
        orden_pago_id: 77,
      },
      metadata: {
        paypal_order_id: "ORDER-123",
      },
    }, {
      paymentOrderId: 77,
      paypalOrderId: "ORDER-123",
      captureFinancials: {
        paypalCaptureId: "CAPTURE-123",
        grossAmount: 10,
        feeAmount: 0.88,
        netAmount: 9.12,
        currencyCode: "USD",
        hasSellerReceivableBreakdown: true,
      },
    });
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown);
  assert.match(thrown.message, /monto_bruto inconsistente/i);
  assert.equal(thrown.statusCode, 409);
});

test("normalizePayPalRefundFinancials extrae refund, capture y order id", () => {
  const normalized = normalizePayPalRefundFinancials({
    id: "REFUND-123",
    status: "COMPLETED",
    amount: {
      currency_code: "USD",
      value: "3.00",
    },
    supplementary_data: {
      related_ids: {
        capture_id: "CAPTURE-123",
        order_id: "ORDER-123",
      },
    },
    seller_payable_breakdown: {
      gross_amount: {
        currency_code: "USD",
        value: "3.00",
      },
      paypal_fee: {
        currency_code: "USD",
        value: "0.25",
      },
      net_amount: {
        currency_code: "USD",
        value: "2.75",
      },
    },
  });

  assert.equal(normalized.paypalRefundId, "REFUND-123");
  assert.equal(normalized.paypalCaptureId, "CAPTURE-123");
  assert.equal(normalized.paypalOrderId, "ORDER-123");
  assert.equal(normalized.grossAmount, 3);
  assert.equal(normalized.feeAmount, 0.25);
  assert.equal(normalized.netAmount, 2.75);
  assert.equal(normalized.refundBreakdownSource, "PAYPAL_CANONICAL");
});

test("normalizePayPalRefundFinancials usa seller_payable_breakdown canonico con prioridad", () => {
  const normalized = normalizePayPalRefundFinancials(buildCanonicalRefund({
    amount: "10.00",
    feeAmount: "0.84",
    netAmount: "9.16",
  }), {
    signedWebhookRefundResource: {
      id: "REFUND-123",
      status: "COMPLETED",
      seller_payable_breakdown: {
        gross_amount: {
          currency_code: "USD",
          value: "10.00",
        },
        paypal_fee: {
          currency_code: "USD",
          value: "0.10",
        },
        net_amount: {
          currency_code: "USD",
          value: "9.90",
        },
      },
    },
    signedWebhookEventType: "PAYMENT.CAPTURE.REFUNDED",
  });

  assert.equal(normalized.grossAmount, 10);
  assert.equal(normalized.feeAmount, 0.84);
  assert.equal(normalized.netAmount, 9.16);
  assert.equal(normalized.refundBreakdownSource, "PAYPAL_CANONICAL");
});

test("normalizePayPalRefundFinancials usa breakdown del webhook firmado cuando el canonico no lo trae", () => {
  const normalized = normalizePayPalRefundFinancials(buildCanonicalRefund({
    includeBreakdown: false,
    amount: "10.00",
  }), {
    signedWebhookRefundResource: {
      id: "REFUND-123",
      status: "COMPLETED",
      seller_payable_breakdown: {
        gross_amount: {
          currency_code: "USD",
          value: "10.00",
        },
        paypal_fee: {
          currency_code: "USD",
          value: "0.84",
        },
        net_amount: {
          currency_code: "USD",
          value: "9.16",
        },
      },
    },
    signedWebhookEventType: "PAYMENT.CAPTURE.REFUNDED",
  });

  assert.equal(normalized.grossAmount, 10);
  assert.equal(normalized.feeAmount, 0.84);
  assert.equal(normalized.netAmount, 9.16);
  assert.equal(normalized.refundBreakdownSource, "SIGNED_WEBHOOK");
});

test("normalizePayPalRefundFinancials rechaza breakdown con monedas inconsistentes", () => {
  assert.throws(
    () => normalizePayPalRefundFinancials(buildCanonicalRefund({
      includeBreakdown: false,
    }), {
      signedWebhookRefundResource: {
        id: "REFUND-123",
        status: "COMPLETED",
        seller_payable_breakdown: {
          gross_amount: {
            currency_code: "USD",
            value: "10.00",
          },
          paypal_fee: {
            currency_code: "EUR",
            value: "0.84",
          },
          net_amount: {
            currency_code: "USD",
            value: "9.16",
          },
        },
      },
      signedWebhookEventType: "PAYMENT.CAPTURE.REFUNDED",
    }),
    /monedas inconsistentes/i,
  );
});

test("normalizePayPalRefundFinancials rechaza breakdown cuando gross - fee no coincide con net", () => {
  assert.throws(
    () => normalizePayPalRefundFinancials(buildCanonicalRefund({
      amount: "10.00",
      feeAmount: "0.84",
      netAmount: "9.00",
    })),
    /gross_amount - paypal_fee no coincide con net_amount/i,
  );
});

test("normalizePayPalRefundFinancials rechaza webhook firmado de otro refund", () => {
  assert.throws(
    () => normalizePayPalRefundFinancials(buildCanonicalRefund({
      includeBreakdown: false,
    }), {
      signedWebhookRefundResource: {
        id: "REFUND-OTRO",
        status: "COMPLETED",
        seller_payable_breakdown: {
          gross_amount: {
            currency_code: "USD",
            value: "3.00",
          },
          paypal_fee: {
            currency_code: "USD",
            value: "0.00",
          },
          net_amount: {
            currency_code: "USD",
            value: "3.00",
          },
        },
      },
      signedWebhookEventType: "PAYMENT.CAPTURE.REFUNDED",
    }),
    /mismo refund PayPal canonico/i,
  );
});

test("normalizePayPalRefundFinancials falla si no hay breakdown ni en refund canonico ni en webhook firmado", () => {
  assert.throws(
    () => normalizePayPalRefundFinancials(buildCanonicalRefund({
      includeBreakdown: false,
    })),
    /PAYPAL_REFUND_BREAKDOWN_UNAVAILABLE/i,
  );
});

test("normalizePayPalRefundFinancials acepta fee explicito 0.00 como valor real", () => {
  const normalized = normalizePayPalRefundFinancials(buildCanonicalRefund({
    amount: "10.00",
    feeAmount: "0.00",
    netAmount: "10.00",
  }));

  assert.equal(normalized.grossAmount, 10);
  assert.equal(normalized.feeAmount, 0);
  assert.equal(normalized.netAmount, 10);
});

test("resolveCaptureIdFromPayPalRefund extrae capture_id desde links rel=up de PayPal", () => {
  const captureId = resolveCaptureIdFromPayPalRefund(buildCanonicalRefund({
    refundId: "14A71298HU368681M",
    captureId: "6T0261648Y4260234",
    includeRelatedIds: false,
    includeCaptureUpLink: true,
    customId: "donacion-unica:95eead8e-0e8d-41d4-abb0-8eda76af5055",
  }));

  assert.equal(captureId, "6T0261648Y4260234");
});

test("resolveOrderIdFromPayPalCapture extrae order_id desde links rel=up de PayPal", () => {
  const orderId = resolveOrderIdFromPayPalCapture(buildCanonicalCapture({
    orderId: "ORDER-LINK-123",
    includeRelatedIds: false,
    includeOrderUpLink: true,
  }));

  assert.equal(orderId, "ORDER-LINK-123");
});

test("normalizePayPalReversalSnapshot usa webhookEvent.id como fact_id canonico y el monto de la captura", () => {
  const normalized = normalizePayPalReversalSnapshot({
    webhookEvent: {
      id: "WH-EVENT-123",
      resource: {
        id: "CAPTURE-123",
        amount: {
          currency_code: "USD",
          value: "10.00",
        },
      },
    },
    canonicalCapture: {
      id: "CAPTURE-123",
      status: "COMPLETED",
      amount: {
        currency_code: "USD",
        value: "10.00",
      },
      supplementary_data: {
        related_ids: {
          order_id: "ORDER-123",
        },
      },
    },
  });

  assert.equal(normalized.reversalFactId, "WH-EVENT-123");
  assert.equal(normalized.providerReversalId, "CAPTURE-123");
  assert.equal(normalized.grossAmount, 10);
});

test("normalizePayPalReversalSnapshot rechaza reversas sin event.id", () => {
  assert.throws(
    () => normalizePayPalReversalSnapshot({
      webhookEvent: {
        resource: {
          id: "CAPTURE-123",
        },
      },
      canonicalCapture: buildCanonicalCapture(),
    }),
    /webhookEvent\.id/i,
  );
});

test("los idempotency keys de refund y reversal mantienen el formato esperado", () => {
  assert.equal(buildPayPalRefundIdempotencyKey("REFUND-123"), "paypal:refund:REFUND-123");
  assert.equal(buildPayPalReversalIdempotencyKey("WH-EVENT-123"), "paypal:reversal:WH-EVENT-123");
});

test("toMinorUnits y fromMinorUnits soportan USD, EUR y CLP", () => {
  assert.equal(toMinorUnits("5.00", "USD"), 500);
  assert.equal(toMinorUnits("0.57", "EUR"), 57);
  assert.equal(toMinorUnits("5000", "CLP"), 5000);
  assert.equal(fromMinorUnits(500, "USD"), 5);
  assert.equal(fromMinorUnits(57, "EUR"), 0.57);
  assert.equal(fromMinorUnits(5000, "CLP"), 5000);
});

test("toMinorUnits rechaza monedas no soportadas y decimales invalidos", () => {
  assert.throws(() => toMinorUnits("1.00", "GBP"), /no esta soportada/i);
  assert.throws(() => toMinorUnits("1.001", "USD"), /excede los decimales soportados/i);
  assert.throws(() => toMinorUnits("10.50", "CLP"), /excede los decimales soportados|no admite decimales/i);
});

test("paypalRequest aborta por timeout y devuelve error sanitizado", async () => {
  let aborted = false;

  await assert.rejects(
    () => paypalRequest("/v2/test-timeout", {
      accessToken: "token-no-real",
      timeoutMs: 5,
      fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted = true;
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      }),
    }),
    (error) => {
      assert.equal(error.name, "PayPalApiError");
      assert.equal(error.statusCode, 504);
      assert.equal(error.code, "PAYPAL_REQUEST_TIMEOUT");
      assert.equal(error.details, null);
      return true;
    },
  );

  assert.equal(aborted, true);
});

test("paypalRequest limpia el timer tras exito y tras error", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timeoutHandles = [];
  const clearedHandles = [];

  globalThis.setTimeout = ((callback) => {
    const handle = {
      unref() {},
      callback,
    };
    timeoutHandles.push(handle);
    return handle;
  });
  globalThis.clearTimeout = ((handle) => {
    clearedHandles.push(handle);
  });

  try {
    const successPayload = await paypalRequest("/v2/test-ok", {
      accessToken: "token-no-real",
      timeoutMs: 25,
      fetchImpl: async () => ({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      }),
    });

    await assert.rejects(
      () => paypalRequest("/v2/test-error", {
        accessToken: "token-no-real",
        timeoutMs: 25,
        fetchImpl: async () => ({
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ message: "PayPal rechazo la solicitud." }),
        }),
      }),
      /PayPal rechazo la solicitud/i,
    );

    assert.deepEqual(successPayload, { ok: true });
    assert.equal(timeoutHandles.length, 2);
    assert.equal(clearedHandles.length, 2);
    assert.deepEqual(clearedHandles, timeoutHandles);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("reconcilePayPalDonationRefund falla de forma segura si el repository transaccional no soporta createQueryBuilder", async () => {
  const { stores, fixtures } = buildBaseStores();
  const originalPaymentOrder = clone(stores.PaymentOrder[0]);

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        disableCreateQueryBuilder: true,
      },
    },
  }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund(),
        source: "test:refund-lock-missing-qb",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /lock pesimista requerido/i);
        assert.equal(error.statusCode, 500);
        return true;
      },
    );
  });

  assert.equal(stores.Transaction.length, 1);
  assert.deepEqual(stores.PaymentOrder[0], originalPaymentOrder);
});

test("reconcilePayPalDonationRefund falla si createQueryBuilder existe pero setLock no esta disponible", async () => {
  const { stores, fixtures } = buildBaseStores();
  const originalPaymentOrder = clone(stores.PaymentOrder[0]);

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        disableSetLock: true,
      },
    },
  }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund(),
        source: "test:refund-lock-missing-setlock",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /lock pesimista requerido/i);
        assert.equal(error.statusCode, 500);
        return true;
      },
    );
  });

  assert.equal(stores.Transaction.length, 1);
  assert.deepEqual(stores.PaymentOrder[0], originalPaymentOrder);
});

test("reconcilePayPalDonationRefund aborta si setLock lanza error y no crea compensacion", async () => {
  const { stores, fixtures } = buildBaseStores();
  const originalPaymentOrder = clone(stores.PaymentOrder[0]);

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        setLockError: new Error("db lock failure"),
      },
    },
  }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund(),
        source: "test:refund-lock-throws",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /lock pesimista requerido/i);
        assert.equal(error.statusCode, 500);
        return true;
      },
    );
  });

  assert.equal(stores.Transaction.length, 1);
  assert.deepEqual(stores.PaymentOrder[0], originalPaymentOrder);
});

test("reconcilePayPalDonationRefund aborta si el lock no encuentra la transaccion original", async () => {
  const { stores, fixtures } = buildBaseStores();
  const originalPaymentOrder = clone(stores.PaymentOrder[0]);

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        getOneResult: async () => null,
      },
    },
  }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund(),
        source: "test:refund-lock-getone-null",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /No fue posible bloquear la transaccion original/i);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  assert.equal(stores.Transaction.length, 1);
  assert.deepEqual(stores.PaymentOrder[0], originalPaymentOrder);
});

test("reconcilePayPalDonationRefund resuelve capture_id desde rel=up, consulta la captura canonica y crea el EGRESO", async () => {
  const { stores, fixtures } = buildBaseStores({
    captureId: "6T0261648Y4260234",
  });
  const fetchedCaptureIds = [];

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        refundId: "14A71298HU368681M",
        captureId: "6T0261648Y4260234",
        includeRelatedIds: false,
        includeCaptureUpLink: true,
        customId: "donacion-unica:95eead8e-0e8d-41d4-abb0-8eda76af5055",
      }),
      source: "test:refund-real-up-link",
      getCanonicalCapture: async (captureId) => {
        fetchedCaptureIds.push(captureId);
        return buildCanonicalCapture({
          captureId,
          orderId: fixtures.paymentOrder.proveedor_orden_id,
        });
      },
    });

    const refundTransaction = stores.Transaction.find(
      (transaction) => transaction.idempotencia_key === "paypal:refund:14A71298HU368681M",
    );

    assert.deepEqual(fetchedCaptureIds, ["6T0261648Y4260234"]);
    assert.equal(result.idempotente, false);
    assert.ok(refundTransaction);
    assert.equal(refundTransaction.category.clave, fixtures.refundCategory.clave);
    assert.equal(refundTransaction.referencia_externa, "14A71298HU368681M");
  });
});

test("reconcilePayPalDonationRefund usa gross, fee y net del breakdown real del refund", async () => {
  const { stores, fixtures } = buildBaseStores({
    captureId: "6T0261648Y4260234",
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        refundId: "14A71298HU368681M",
        captureId: "6T0261648Y4260234",
        amount: "10.00",
        feeAmount: "0.84",
        netAmount: "9.16",
      }),
      source: "test:refund-breakdown-real-values",
      getCanonicalCapture: async (captureId) => buildCanonicalCapture({
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
      }),
    });
  });

  const refundTransaction = stores.Transaction.find(
    (transaction) => transaction.idempotencia_key === "paypal:refund:14A71298HU368681M",
  );

  assert.ok(refundTransaction);
  assert.equal(refundTransaction.monto_bruto, 10);
  assert.equal(refundTransaction.monto_fee, 0.84);
  assert.equal(refundTransaction.monto_neto, 9.16);
  assert.equal(refundTransaction.metadata.refund_breakdown_source, "PAYPAL_CANONICAL");
  assert.equal(refundTransaction.metadata.paypal_fee_effect, "CREDITED_OR_OFFSET_BY_PAYPAL");
  assert.equal(stores.PaymentOrder[0].metadata.refund_summary.total_refunded, 10);
  assert.equal(stores.PaymentOrder[0].metadata.refund_summary.remaining_amount, 0);
});

test("reconcilePayPalDonationRefund usa la Transaction original como fallback fuerte cuando la captura canonica no trae order_id", async () => {
  const { stores, fixtures } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        refundId: "REFUND-NO-ORDER",
        captureId: fixtures.originalCaptureTransaction.referencia_externa,
        includeRelatedIds: false,
        includeCaptureUpLink: true,
      }),
      source: "test:refund-transaction-fallback",
      getCanonicalCapture: async (captureId) => buildCanonicalCapture({
        captureId,
        includeRelatedIds: false,
      }),
    });

    const refundTransaction = stores.Transaction.find(
      (transaction) => transaction.idempotencia_key === "paypal:refund:REFUND-NO-ORDER",
    );

    assert.equal(result.idempotente, false);
    assert.ok(refundTransaction);
    assert.equal(refundTransaction.payment_order.orden_pago_id, fixtures.paymentOrder.orden_pago_id);
  });
});

test("reconcilePayPalDonationRefund usa breakdown del webhook firmado si el refund canonico no lo trae", async () => {
  const { stores, fixtures } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        includeBreakdown: false,
      }),
      source: "test:refund-webhook-breakdown-fallback",
      signedWebhookRefundResource: {
        id: "REFUND-123",
        status: "COMPLETED",
        seller_payable_breakdown: {
          gross_amount: {
            currency_code: "USD",
            value: "3.00",
          },
          paypal_fee: {
            currency_code: "USD",
            value: "0.20",
          },
          net_amount: {
            currency_code: "USD",
            value: "2.80",
          },
        },
      },
      signedWebhookEventType: "PAYMENT.CAPTURE.REFUNDED",
      getCanonicalCapture: buildCanonicalCaptureResolver({
        paymentOrder: fixtures.paymentOrder,
      }),
    });
  });

  const refundTransaction = stores.Transaction.find(
    (transaction) => transaction.idempotencia_key === "paypal:refund:REFUND-123",
  );

  assert.ok(refundTransaction);
  assert.equal(refundTransaction.monto_bruto, 3);
  assert.equal(refundTransaction.monto_fee, 0.2);
  assert.equal(refundTransaction.monto_neto, 2.8);
  assert.equal(refundTransaction.metadata.refund_breakdown_source, "SIGNED_WEBHOOK");
});

test("reconcilePayPalDonationRefund rechaza resoluciones fuertes contradictorias entre order_id y Transaction original", async () => {
  const { stores, fixtures } = buildBaseStores();
  const conflictingPaymentOrder = buildPaymentOrder({
    orderId: 99,
    paypalOrderId: "ORDER-CONFLICT",
  });
  stores.PaymentOrder.push(conflictingPaymentOrder);

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          refundId: "REFUND-CONFLICT",
          captureId: fixtures.originalCaptureTransaction.referencia_externa,
          includeRelatedIds: false,
          includeCaptureUpLink: true,
        }),
        source: "test:refund-conflict",
        getCanonicalCapture: async (captureId) => buildCanonicalCapture({
          captureId,
          orderId: "ORDER-CONFLICT",
        }),
      }),
      (error) => {
        assert.match(error.message, /referencias locales contradictorias|paypal_order_id inconsistente|otra orden local/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  assert.equal(
    stores.Transaction.filter((transaction) => transaction.referencia_externa === "REFUND-CONFLICT").length,
    0,
  );
});

test("reconcilePayPalDonationRefund no usa busquedas debiles por monto o fecha cuando faltan order_id y Transaction original", async () => {
  const { stores } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          refundId: "REFUND-NO-WEAK-MATCH",
          captureId: "CAPTURE-DESCONOCIDA",
          includeRelatedIds: false,
          includeCaptureUpLink: true,
        }),
        source: "test:refund-no-weak-search",
        getCanonicalCapture: async (captureId) => buildCanonicalCapture({
          captureId,
          includeRelatedIds: false,
        }),
      }),
      (error) => {
        assert.match(error.message, /Orden de pago no encontrada/i);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  assert.equal(
    stores.Transaction.filter((transaction) => transaction.referencia_externa === "REFUND-NO-WEAK-MATCH").length,
    0,
  );
});

test("reconcilePayPalDonationRefund no crea EGRESO si el breakdown no esta disponible en ninguna fuente", async () => {
  const { stores, fixtures } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          includeBreakdown: false,
        }),
        source: "test:refund-no-breakdown",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /PAYPAL_REFUND_BREAKDOWN_UNAVAILABLE/i);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  assert.equal(
    stores.Transaction.filter((transaction) => transaction.tipo === "EGRESO").length,
    0,
  );
});

test("reconcilePayPalDonationRefund crea un EGRESO valido y actualiza metadata segura", async () => {
  const { stores, fixtures } = buildBaseStores();
  const lockModes = [];

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        onSetLock({ mode }) {
          lockModes.push(mode);
        },
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund(),
      source: "test:refund-completed",
      webhookEventId: "WH-REFUND-123",
      getCanonicalCapture: buildCanonicalCaptureResolver({
        paymentOrder: fixtures.paymentOrder,
      }),
    });

    const refundTransaction = stores.Transaction.find(
      (transaction) => transaction.idempotencia_key === "paypal:refund:REFUND-123",
    );

    assert.equal(result.idempotente, false);
    assert.ok(refundTransaction);
    assert.equal(refundTransaction.tipo, "EGRESO");
    assert.equal(refundTransaction.category.clave, fixtures.refundCategory.clave);
    assert.equal(refundTransaction.payment_provider.clave, "PAYPAL");
    assert.equal(refundTransaction.referencia_externa, "REFUND-123");
    assert.equal(refundTransaction.metadata.adjustment_type, "REFUND");
    assert.equal(refundTransaction.metadata.original_transaction_id, fixtures.originalCaptureTransaction.transaccion_id);
    assert.equal(stores.PaymentOrder[0].metadata.refund_summary.total_refunded, 3);
    assert.equal(stores.PaymentOrder[0].metadata.refund_summary.remaining_amount, 7);
    assert.deepEqual(stores.PaymentOrder[0].metadata.refund_summary.refund_ids, ["REFUND-123"]);
    assert.equal(stores.PaymentOrder[0].estado, "CAPTURADA");
  });

  assert.deepEqual(lockModes, ["pessimistic_write"]);
});

test("reconcilePayPalDonationRefund no crea EGRESO cuando el refund canonico no esta COMPLETED", async () => {
  const { stores } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({ status: "PENDING" }),
        source: "test:refund-pending",
      }),
      (error) => {
        assert.match(error.message, /no esta COMPLETED/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  assert.equal(stores.Transaction.length, 1);
});

test("reconcilePayPalDonationRefund permite refunds parciales validos y rechaza el sobre-refund antes del insert", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.Transaction.push({
    transaccion_id: 101,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.refundCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Refund parcial previo",
    moneda: "USD",
    monto_bruto: 8,
    monto_fee: 0,
    monto_neto: 8,
    referencia_externa: "REFUND-ANTERIOR",
    idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-ANTERIOR"),
    origen_tipo: "PAYPAL_DONATION_REFUND",
    metadata: {
      adjustment_type: "REFUND",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          refundId: "REFUND-EXCESIVO",
          amount: "3.00",
        }),
        source: "test:over-refund",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /supera el monto bruto capturado/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  const overRefundTransaction = stores.Transaction.find(
    (transaction) => transaction.referencia_externa === "REFUND-EXCESIVO",
  );

  assert.equal(overRefundTransaction, undefined);
});

test("reconcilePayPalDonationRefund devuelve idempotente en replay del mismo refund sin duplicar EGRESO", async () => {
  const { stores, fixtures } = buildBaseStores();
  const events = [];
  stores.Transaction.push({
    transaccion_id: 101,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.refundCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Refund existente",
    moneda: "USD",
    monto_bruto: 3,
    monto_fee: 0,
    monto_neto: 3,
    referencia_externa: "REFUND-123",
    idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-123"),
    origen_tipo: "PAYPAL_DONATION_REFUND",
    metadata: {
      adjustment_type: "REFUND",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        onSetLock({ mode }) {
          events.push(`lock:${mode}`);
        },
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund(),
      source: "test:refund-replay",
      getCanonicalCapture: buildCanonicalCaptureResolver({
        paymentOrder: fixtures.paymentOrder,
      }),
    });

    assert.equal(result.idempotente, true);
  });

  assert.equal(
    stores.Transaction.filter((transaction) => transaction.referencia_externa === "REFUND-123").length,
    1,
  );
  assert.deepEqual(events, ["lock:pessimistic_write"]);
});

test("reconcilePayPalDonationRefund enriquece idempotentemente una Transaction existente con fee/net provisionales", async () => {
  const { stores, fixtures } = buildBaseStores({
    captureId: "6T0261648Y4260234",
  });
  stores.Transaction.push({
    transaccion_id: 101,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.refundCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Refund existente provisional",
    moneda: "USD",
    monto_bruto: 10,
    monto_fee: 0,
    monto_neto: 10,
    referencia_externa: "14A71298HU368681M",
    idempotencia_key: buildPayPalRefundIdempotencyKey("14A71298HU368681M"),
    origen_tipo: "PAYPAL_DONATION_REFUND",
    metadata: {
      adjustment_type: "REFUND",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        refundId: "14A71298HU368681M",
        captureId: "6T0261648Y4260234",
        amount: "10.00",
        feeAmount: "0.84",
        netAmount: "9.16",
      }),
      source: "test:refund-enrichment",
      getCanonicalCapture: async (captureId) => buildCanonicalCapture({
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
      }),
    });

    assert.equal(result.idempotente, true);
  });

  const enrichedTransaction = stores.Transaction.find(
    (transaction) => transaction.idempotencia_key === "paypal:refund:14A71298HU368681M",
  );

  assert.equal(
    stores.Transaction.filter((transaction) => transaction.idempotencia_key === "paypal:refund:14A71298HU368681M").length,
    1,
  );
  assert.equal(enrichedTransaction.monto_bruto, 10);
  assert.equal(enrichedTransaction.monto_fee, 0.84);
  assert.equal(enrichedTransaction.monto_neto, 9.16);
  assert.equal(enrichedTransaction.metadata.refund_breakdown_source, "PAYPAL_CANONICAL");
});

test("reconcilePayPalDonationRefund rechaza enriquecimiento si la Transaction existente tiene monto_bruto distinto", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.Transaction.push({
    transaccion_id: 101,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.refundCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Refund existente con bruto incorrecto",
    moneda: "USD",
    monto_bruto: 9,
    monto_fee: 0,
    monto_neto: 9,
    referencia_externa: "REFUND-123",
    idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-123"),
    origen_tipo: "PAYPAL_DONATION_REFUND",
    metadata: {
      adjustment_type: "REFUND",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          amount: "10.00",
          feeAmount: "0.84",
          netAmount: "9.16",
        }),
        source: "test:refund-enrichment-gross-conflict",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /monto_bruto inconsistente/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});

test("reconcilePayPalDonationRefund rechaza enriquecimiento si la Transaction existente tiene moneda distinta", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.Transaction.push({
    transaccion_id: 101,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.refundCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Refund existente con moneda incorrecta",
    moneda: "EUR",
    monto_bruto: 3,
    monto_fee: 0,
    monto_neto: 3,
    referencia_externa: "REFUND-123",
    idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-123"),
    origen_tipo: "PAYPAL_DONATION_REFUND",
    metadata: {
      adjustment_type: "REFUND",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund(),
        source: "test:refund-enrichment-currency-conflict",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /moneda inconsistente/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});

test("reconcilePayPalDonationRefund usa el breakdown especifico del refund parcial", async () => {
  const { stores, fixtures } = buildBaseStores({
    grossAmount: 10,
  });

  await withFakeAccountingContext({ stores }, async () => {
    await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund({
        refundId: "REFUND-PARCIAL",
        amount: "4.00",
        feeAmount: "0.10",
        netAmount: "3.90",
      }),
      source: "test:refund-partial-breakdown",
      getCanonicalCapture: buildCanonicalCaptureResolver({
        paymentOrder: fixtures.paymentOrder,
      }),
    });
  });

  const partialRefund = stores.Transaction.find(
    (transaction) => transaction.idempotencia_key === "paypal:refund:REFUND-PARCIAL",
  );

  assert.ok(partialRefund);
  assert.equal(partialRefund.monto_bruto, 4);
  assert.equal(partialRefund.monto_fee, 0.1);
  assert.equal(partialRefund.monto_neto, 3.9);
});

test("reconcilePayPalDonationRefund no acepta una Transaction INGRESO como compensacion existente", async () => {
  const { stores } = buildBaseStores({
    extraTransactions: [
      {
        transaccion_id: 102,
        tipo: "INGRESO",
        estado: "CONFIRMADA",
        category: buildCategories()[0],
        payment_provider: buildPayPalProvider(),
        payment_order: buildPaymentOrder(),
        donor: null,
        descripcion: "Colision peligrosa",
        moneda: "USD",
        monto_bruto: 3,
        monto_fee: 0,
        monto_neto: 3,
        referencia_externa: "REFUND-COLLISION",
        idempotencia_key: "otro:ingreso:refund-collision",
        origen_tipo: "PAYPAL_DONATION_CAPTURE",
        metadata: {
          paypal_capture_id: "CAPTURE-123",
        },
      },
    ],
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          refundId: "REFUND-COLLISION",
        }),
        source: "test:refund-collision",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: buildPaymentOrder(),
        }),
      }),
      (error) => {
        assert.match(error.message, /no corresponde a una compensacion EGRESO valida/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});

test("reconcilePayPalDonationRefund recupera fuera del manager abortado tras 23505", async () => {
  const { stores, fixtures } = buildBaseStores();
  let duplicateTriggered = false;

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Transaction(entity, context) {
        if (
          !duplicateTriggered
          && entity.idempotencia_key === buildPayPalRefundIdempotencyKey("REFUND-123")
        ) {
          duplicateTriggered = true;
          context.upsert({
            ...entity,
            transaccion_id: 200,
            category: fixtures.refundCategory,
            payment_provider: fixtures.paypalProvider,
            payment_order: fixtures.paymentOrder,
          });
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }

        return context.upsert({
          ...entity,
          category: fixtures.refundCategory,
          payment_provider: fixtures.paypalProvider,
          payment_order: fixtures.paymentOrder,
        });
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationRefund({
      refund: buildCanonicalRefund(),
      source: "test:refund-23505",
      getCanonicalCapture: buildCanonicalCaptureResolver({
        paymentOrder: fixtures.paymentOrder,
      }),
    });

    assert.equal(result.idempotente, true);
    assert.equal(result.transaccion.idempotencia_key, "paypal:refund:REFUND-123");
  });
});

test("reconcilePayPalDonationRefund recalcula el total solo después de adquirir el lock pesimista", async () => {
  const { stores, fixtures } = buildBaseStores();
  const events = [];
  let injectedSerializedRefund = false;

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        onSetLock({ mode }) {
          events.push(`lock:${mode}`);
        },
        async getOneResult({ transactionId, repository }) {
          events.push(`getOne:${transactionId}`);

          if (!injectedSerializedRefund) {
            injectedSerializedRefund = true;
            repository.items.push(clone({
              transaccion_id: 199,
              tipo: "EGRESO",
              estado: "CONFIRMADA",
              category: fixtures.refundCategory,
              payment_provider: fixtures.paypalProvider,
              payment_order: fixtures.paymentOrder,
              donor: null,
              descripcion: "Refund serializado durante el lock",
              moneda: "USD",
              monto_bruto: 8,
              monto_fee: 0,
              monto_neto: 8,
              referencia_externa: "REFUND-SERIALIZED",
              idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-SERIALIZED"),
              origen_tipo: "PAYPAL_DONATION_REFUND",
              metadata: {
                adjustment_type: "REFUND",
                original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
                original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
                original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
              },
            }));
          }

          return repository.findOne({
            where: {
              transaccion_id: Number(transactionId),
            },
          });
        },
      },
    },
  }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationRefund({
        refund: buildCanonicalRefund({
          refundId: "REFUND-RACE",
          amount: "3.00",
        }),
        source: "test:refund-race-after-lock",
        getCanonicalCapture: buildCanonicalCaptureResolver({
          paymentOrder: fixtures.paymentOrder,
        }),
      }),
      (error) => {
        assert.match(error.message, /supera el monto bruto capturado/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  assert.deepEqual(events, [
    "lock:pessimistic_write",
    "getOne:100",
  ]);
  assert.equal(
    stores.Transaction.filter((transaction) => transaction.referencia_externa === "REFUND-RACE").length,
    0,
  );
});

test("createAdminPayPalDonationRefundService crea un refund parcial dentro de 48 horas", async () => {
  const { stores, fixtures } = buildBaseStores();
  let refundCalls = 0;

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 3,
      reason: "Donacion duplicada",
      authContext: { userId: 77 },
      now: new Date("2026-06-18T10:00:00Z"),
      createRefund: async (captureId, options) => {
        refundCalls += 1;
        assert.equal(captureId, fixtures.originalCaptureTransaction.referencia_externa);
        assert.equal(options.currencyCode, "USD");
        assert.equal(options.amount, 3);
        return buildCanonicalRefund({
          refundId: "ADMIN-REFUND-1",
          captureId,
          orderId: fixtures.paymentOrder.proveedor_orden_id,
          amount: "3.00",
        });
      },
    });

    assert.equal(error, null);
    assert.equal(result.transaccion.tipo, "EGRESO");
    assert.equal(result.transaccion.metadata.refund_reason, "Donacion duplicada");
    assert.equal(result.orden_pago.metadata.refund_summary.total_refunded, 3);
    assert.equal(result.orden_pago.metadata.refund_summary.remaining_amount, 7);
  });

  assert.equal(refundCalls, 1);
});

test("createAdminPayPalDonationRefundService permite refund hasta 47h 59m 59s desde la captura original", async () => {
  const { stores, fixtures } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Refund aun dentro de plazo",
      now: new Date("2026-06-19T11:59:59Z"),
      createRefund: async (captureId) => buildCanonicalRefund({
        refundId: "ADMIN-REFUND-47H",
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
        amount: "2.00",
      }),
    });

    assert.equal(error, null);
    assert.equal(result.transaccion.referencia_externa, "ADMIN-REFUND-47H");
  });
});

test("createAdminPayPalDonationRefundService permite refund total del saldo restante dentro de plazo", async () => {
  const { stores, fixtures } = buildBaseStores({
    extraTransactions: [
      {
        transaccion_id: 120,
        tipo: "EGRESO",
        estado: "CONFIRMADA",
        category: buildCategories()[1],
        payment_provider: buildPayPalProvider(),
        payment_order: buildPaymentOrder(),
        donor: null,
        descripcion: "Refund previo",
        moneda: "USD",
        monto_bruto: 4,
        monto_fee: 0,
        monto_neto: 4,
        fecha_transaccion: "2026-06-17T12:10:00Z",
        referencia_externa: "REFUND-PREVIO",
        idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-PREVIO"),
        origen_tipo: "PAYPAL_DONATION_REFUND",
        metadata: {
          adjustment_type: "REFUND",
          paypal_refund_id: "REFUND-PREVIO",
          refund_fact_id: "REFUND-PREVIO",
          original_transaction_id: 100,
          original_capture_id: "CAPTURE-123",
          original_payment_order_id: 20,
        },
      },
    ],
  });

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 6,
      reason: "Solicitud del donante",
      now: new Date("2026-06-18T10:00:00Z"),
      createRefund: async (captureId) => buildCanonicalRefund({
        refundId: "ADMIN-REFUND-TOTAL",
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
        amount: "6.00",
      }),
    });

    assert.equal(error, null);
    assert.equal(result.orden_pago.estado, "REEMBOLSADA");
    assert.equal(result.orden_pago.metadata.refund_summary.total_refunded, 10);
    assert.equal(result.orden_pago.metadata.refund_summary.remaining_amount, 0);
  });
});

test("createAdminPayPalDonationRefundService acepta exactamente el limite de 48 horas", async () => {
  const { stores, fixtures } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Monto incorrecto",
      now: new Date("2026-06-19T12:00:00Z"),
      createRefund: async (captureId) => buildCanonicalRefund({
        refundId: "ADMIN-REFUND-LIMIT",
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
        amount: "2.00",
      }),
    });

    assert.equal(error, null);
    assert.equal(result.transaccion.referencia_externa, "ADMIN-REFUND-LIMIT");
  });
});

test("createAdminPayPalDonationRefundService bloquea el refund después de 48 horas sin llamar PayPal", async () => {
  const { stores, fixtures } = buildBaseStores();
  let refundCalls = 0;

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Fuera de plazo",
      now: new Date("2026-06-19T12:00:00.001Z"),
      createRefund: async () => {
        refundCalls += 1;
        return buildCanonicalRefund();
      },
    });

    assert.equal(result, null);
    assert.match(error.message, /plazo de 48 horas/i);
    assert.equal(error.statusCode, 409);
  });

  assert.equal(refundCalls, 0);
  assert.equal(stores.Transaction.filter((transaction) => transaction.tipo === "EGRESO").length, 0);
});

test("createAdminPayPalDonationRefundService bloquea ordenes sin timestamp confiable sin llamar PayPal ni crear EGRESO", async () => {
  const { stores, fixtures } = buildBaseStores();
  let refundCalls = 0;

  stores.PaymentOrder[0].capturada_en = null;
  stores.PaymentOrder[0].metadata.paypal.update_time = "2026-06-20T10:00:00Z";
  stores.PaymentOrder[0].updatedAt = "2026-06-20T10:00:00Z";
  stores.Transaction[0].fecha_transaccion = null;

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Timestamp inseguro",
      now: new Date("2026-06-20T10:05:00Z"),
      createRefund: async () => {
        refundCalls += 1;
        return buildCanonicalRefund();
      },
    });

    assert.equal(result, null);
    assert.match(error.message, /no fue posible determinar de forma segura la fecha de captura/i);
    assert.equal(error.statusCode, 409);
  });

  assert.equal(refundCalls, 0);
  assert.equal(stores.Transaction.filter((transaction) => transaction.tipo === "EGRESO").length, 0);
  assert.equal(stores.PaymentOrder[0].metadata?.refund_summary || null, null);
});

test("createAdminPayPalDonationRefundService permite un segundo refund parcial dentro de las 48 horas originales", async () => {
  const { stores, fixtures } = buildBaseStores({
    extraTransactions: [
      {
        transaccion_id: 130,
        tipo: "EGRESO",
        estado: "CONFIRMADA",
        category: buildCategories()[1],
        payment_provider: buildPayPalProvider(),
        payment_order: buildPaymentOrder(),
        donor: null,
        descripcion: "Refund parcial previo",
        moneda: "USD",
        monto_bruto: 3,
        monto_fee: 0,
        monto_neto: 3,
        fecha_transaccion: "2026-06-17T18:00:00Z",
        referencia_externa: "REFUND-PREVIO-WINDOW",
        idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-PREVIO-WINDOW"),
        origen_tipo: "PAYPAL_DONATION_REFUND",
        metadata: {
          adjustment_type: "REFUND",
          paypal_refund_id: "REFUND-PREVIO-WINDOW",
          refund_fact_id: "REFUND-PREVIO-WINDOW",
          original_transaction_id: 100,
          original_capture_id: "CAPTURE-123",
          original_payment_order_id: 20,
        },
      },
    ],
  });

  stores.PaymentOrder[0].updatedAt = "2026-06-18T09:00:00Z";
  stores.PaymentOrder[0].metadata.refund_summary = {
    refund_ids: ["REFUND-PREVIO-WINDOW"],
    total_refunded: 3,
    remaining_amount: 7,
    paypal_refund_status: "COMPLETED",
    fully_refunded: false,
    last_refund_id: "REFUND-PREVIO-WINDOW",
  };
  stores.PaymentOrder[0].metadata.paypal.update_time = "2026-06-18T09:00:00Z";

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Segundo parcial dentro de plazo original",
      now: new Date("2026-06-18T11:00:00Z"),
      createRefund: async (captureId) => buildCanonicalRefund({
        refundId: "ADMIN-REFUND-SECOND-IN",
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
        amount: "2.00",
      }),
    });

    assert.equal(error, null);
    assert.equal(result.orden_pago.metadata.refund_summary.total_refunded, 5);
    assert.equal(result.orden_pago.metadata.refund_summary.remaining_amount, 5);
  });
});

test("createAdminPayPalDonationRefundService no reinicia la ventana tras refund parcial ni con update_time posterior", async () => {
  const { stores, fixtures } = buildBaseStores({
    extraTransactions: [
      {
        transaccion_id: 131,
        tipo: "EGRESO",
        estado: "CONFIRMADA",
        category: buildCategories()[1],
        payment_provider: buildPayPalProvider(),
        payment_order: buildPaymentOrder(),
        donor: null,
        descripcion: "Refund parcial previo",
        moneda: "USD",
        monto_bruto: 3,
        monto_fee: 0,
        monto_neto: 3,
        fecha_transaccion: "2026-06-17T18:00:00Z",
        referencia_externa: "REFUND-PREVIO-OUT",
        idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-PREVIO-OUT"),
        origen_tipo: "PAYPAL_DONATION_REFUND",
        metadata: {
          adjustment_type: "REFUND",
          paypal_refund_id: "REFUND-PREVIO-OUT",
          refund_fact_id: "REFUND-PREVIO-OUT",
          original_transaction_id: 100,
          original_capture_id: "CAPTURE-123",
          original_payment_order_id: 20,
        },
      },
    ],
  });
  let refundCalls = 0;

  stores.PaymentOrder[0].updatedAt = "2026-06-20T09:00:00Z";
  stores.PaymentOrder[0].metadata.refund_summary = {
    refund_ids: ["REFUND-PREVIO-OUT"],
    total_refunded: 3,
    remaining_amount: 7,
    paypal_refund_status: "COMPLETED",
    fully_refunded: false,
    last_refund_id: "REFUND-PREVIO-OUT",
  };
  stores.PaymentOrder[0].metadata.paypal.update_time = "2026-06-20T09:00:00Z";

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Segundo parcial fuera de plazo original",
      now: new Date("2026-06-19T12:00:00.001Z"),
      createRefund: async () => {
        refundCalls += 1;
        return buildCanonicalRefund();
      },
    });

    assert.equal(result, null);
    assert.match(error.message, /plazo de 48 horas/i);
    assert.equal(error.statusCode, 409);
  });

  assert.equal(refundCalls, 0);
  assert.equal(
    stores.Transaction.filter((transaction) => transaction.referencia_externa === "ADMIN-REFUND-SECOND-OUT").length,
    0,
  );
});

test("createAdminPayPalDonationRefundService bloquea montos mayores al saldo", async () => {
  const { stores, fixtures } = buildBaseStores({
    extraTransactions: [
      {
        transaccion_id: 121,
        tipo: "EGRESO",
        estado: "CONFIRMADA",
        category: buildCategories()[1],
        payment_provider: buildPayPalProvider(),
        payment_order: buildPaymentOrder(),
        donor: null,
        descripcion: "Refund previo",
        moneda: "USD",
        monto_bruto: 7,
        monto_fee: 0,
        monto_neto: 7,
        fecha_transaccion: "2026-06-17T12:10:00Z",
        referencia_externa: "REFUND-PREVIO-2",
        idempotencia_key: buildPayPalRefundIdempotencyKey("REFUND-PREVIO-2"),
        origen_tipo: "PAYPAL_DONATION_REFUND",
        metadata: {
          adjustment_type: "REFUND",
          paypal_refund_id: "REFUND-PREVIO-2",
          refund_fact_id: "REFUND-PREVIO-2",
          original_transaction_id: 100,
          original_capture_id: "CAPTURE-123",
          original_payment_order_id: 20,
        },
      },
    ],
  });
  let refundCalls = 0;

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 4,
      reason: "Exceso",
      now: new Date("2026-06-18T10:00:00Z"),
      createRefund: async () => {
        refundCalls += 1;
        return buildCanonicalRefund();
      },
    });

    assert.equal(result, null);
    assert.match(error.message, /saldo reembolsable/i);
    assert.equal(error.statusCode, 409);
  });

  assert.equal(refundCalls, 0);
});

test("createAdminPayPalDonationRefundService bloquea proveedores no PayPal", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.PaymentOrder[0].payment_provider = fixtures.manualProvider;

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 2,
      reason: "Proveedor manual",
      createRefund: async () => buildCanonicalRefund(),
    });

    assert.equal(result, null);
    assert.match(error.message, /solo las donaciones paypal/i);
    assert.equal(error.statusCode, 409);
  });
});

test("createAdminPayPalDonationRefundService permite donaciones anonimas", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.PaymentOrder[0].donor = null;
  stores.PaymentOrder[0].metadata.donor_identity_mode = "ANONYMOUS";

  await withFakeAccountingContext({ stores }, async () => {
    const [result, error] = await createAdminPayPalDonationRefundService({
      paymentOrderId: fixtures.paymentOrder.orden_pago_id,
      amount: 1,
      reason: "Solicitud del pagador",
      now: new Date("2026-06-18T10:00:00Z"),
      createRefund: async (captureId) => buildCanonicalRefund({
        refundId: "ADMIN-ANON-1",
        captureId,
        orderId: fixtures.paymentOrder.proveedor_orden_id,
        amount: "1.00",
      }),
    });

    assert.equal(error, null);
    assert.equal(result.transaccion.donor, null);
  });
});

test("reconcilePayPalDonationReversal crea exactamente un EGRESO y usa webhookEvent.id como fact ID", async () => {
  const { stores, fixtures } = buildBaseStores();
  const lockModes = [];

  await withFakeAccountingContext({
    stores,
    repositoryBehaviors: {
      Transaction: {
        onSetLock({ mode }) {
          lockModes.push(mode);
        },
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationReversal({
      webhookEvent: buildWebhookReversalEvent({
        eventId: "WH-REVERSAL-123",
        resourceId: "CAPTURE-123",
      }),
      canonicalCapture: buildCanonicalCapture(),
      source: "test:reversal",
    });

    const reversalTransaction = stores.Transaction.find(
      (transaction) => transaction.idempotencia_key === "paypal:reversal:WH-REVERSAL-123",
    );

    assert.equal(result.idempotente, false);
    assert.ok(reversalTransaction);
    assert.equal(reversalTransaction.tipo, "EGRESO");
    assert.equal(reversalTransaction.category.clave, fixtures.reversalCategory.clave);
    assert.equal(reversalTransaction.referencia_externa, "WH-REVERSAL-123");
    assert.equal(reversalTransaction.metadata.adjustment_type, "REVERSAL");
    assert.equal(reversalTransaction.metadata.paypal_event_id, "WH-REVERSAL-123");
    assert.equal(reversalTransaction.metadata.original_capture_id, "CAPTURE-123");
    assert.equal(reversalTransaction.metadata.original_transaction_id, 100);
  });

  assert.deepEqual(lockModes, ["pessimistic_write"]);
});

test("reconcilePayPalDonationReversal no confunde la Transaction INGRESO original aunque capture.id coincida", async () => {
  const { stores } = buildBaseStores();

  await withFakeAccountingContext({ stores }, async () => {
    const result = await reconcilePayPalDonationReversal({
      webhookEvent: buildWebhookReversalEvent({
        eventId: "WH-REVERSAL-SEGURA",
        resourceId: "CAPTURE-123",
      }),
      canonicalCapture: buildCanonicalCapture(),
      source: "test:reversal-safe",
    });

    assert.equal(result.idempotente, false);
    assert.equal(result.transaccion.referencia_externa, "WH-REVERSAL-SEGURA");
  });
});

test("reconcilePayPalDonationReversal rechaza un segundo event.id para la misma captura", async () => {
  const { stores, fixtures } = buildBaseStores();
  stores.Transaction.push({
    transaccion_id: 201,
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: fixtures.reversalCategory,
    payment_provider: fixtures.paypalProvider,
    payment_order: fixtures.paymentOrder,
    donor: null,
    descripcion: "Reversa existente",
    moneda: "USD",
    monto_bruto: 10,
    monto_fee: 0,
    monto_neto: 10,
    referencia_externa: "WH-REVERSAL-ORIGINAL",
    idempotencia_key: buildPayPalReversalIdempotencyKey("WH-REVERSAL-ORIGINAL"),
    origen_tipo: "PAYPAL_DONATION_REVERSAL",
    metadata: {
      adjustment_type: "REVERSAL",
      original_transaction_id: fixtures.originalCaptureTransaction.transaccion_id,
      original_capture_id: fixtures.originalCaptureTransaction.referencia_externa,
      original_payment_order_id: fixtures.paymentOrder.orden_pago_id,
    },
  });

  await withFakeAccountingContext({ stores }, async () => {
    await assert.rejects(
      () => reconcilePayPalDonationReversal({
        webhookEvent: buildWebhookReversalEvent({
          eventId: "WH-REVERSAL-NUEVA",
        }),
        canonicalCapture: buildCanonicalCapture(),
        source: "test:reversal-duplicate",
      }),
      (error) => {
        assert.match(error.message, /Ya existe una reversa PayPal completa/i);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });
});

test("reconcilePayPalDonationReversal recupera fuera del manager abortado tras 23505", async () => {
  const { stores, fixtures } = buildBaseStores();
  let duplicateTriggered = false;

  await withFakeAccountingContext({
    stores,
    saveBehaviors: {
      Transaction(entity, context) {
        if (
          !duplicateTriggered
          && entity.idempotencia_key === buildPayPalReversalIdempotencyKey("WH-REVERSAL-123")
        ) {
          duplicateTriggered = true;
          context.upsert({
            ...entity,
            transaccion_id: 300,
            category: fixtures.reversalCategory,
            payment_provider: fixtures.paypalProvider,
            payment_order: fixtures.paymentOrder,
          });
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }

        return context.upsert({
          ...entity,
          category: fixtures.reversalCategory,
          payment_provider: fixtures.paypalProvider,
          payment_order: fixtures.paymentOrder,
        });
      },
    },
  }, async () => {
    const result = await reconcilePayPalDonationReversal({
      webhookEvent: buildWebhookReversalEvent({
        eventId: "WH-REVERSAL-123",
      }),
      canonicalCapture: buildCanonicalCapture(),
      source: "test:reversal-23505",
    });

    assert.equal(result.idempotente, true);
    assert.equal(result.transaccion.idempotencia_key, "paypal:reversal:WH-REVERSAL-123");
  });
});

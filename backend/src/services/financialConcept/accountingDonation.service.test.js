"use strict";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AppDataSource } from "./accounting.shared.js";
import {
  buildAccountingDonationItem,
  buildAccountingDonationSummary,
  deriveDonationVisibleStatus,
  getAccountingDonationsService,
  matchesAccountingDonationFilters,
  sortAccountingDonations,
} from "./accountingDonation.service.js";

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function getRepositoryKey(target) {
  if (typeof target === "string") return target;
  return target?.options?.name || target?.name || String(target);
}

function isFindOperator(expectedValue) {
  return Boolean(
    expectedValue
    && typeof expectedValue === "object"
    && (
      expectedValue.constructor?.name === "FindOperator"
      || "_type" in expectedValue
      || "type" in expectedValue
    ),
  );
}

function matchesFindOperator(currentValue, operator) {
  const type = operator?._type || operator?.type;
  const value = operator?._value || operator?.value;

  switch (String(type || "").toLowerCase()) {
    case "in":
      return Array.isArray(value) && value.some((item) => Number(item) === Number(currentValue));
    default:
      return currentValue === value;
  }
}

function matchesWhere(record, where) {
  if (!where) return true;

  if (Array.isArray(where)) {
    return where.some((entry) => matchesWhere(record, entry));
  }

  return Object.entries(where).every(([key, expectedValue]) => {
    const currentValue = record?.[key];

    if (isFindOperator(expectedValue)) {
      return matchesFindOperator(currentValue, expectedValue);
    }

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
  constructor(items) {
    this.items = items;
  }

  async find({ where } = {}) {
    return clone(this.items.filter((item) => matchesWhere(item, where)));
  }
}

async function withFakeAccountingContext(stores, callback) {
  const originalGetRepository = AppDataSource.getRepository;

  AppDataSource.getRepository = (target) => new FakeRepository(stores[getRepositoryKey(target)] || []);

  try {
    return await callback();
  } finally {
    AppDataSource.getRepository = originalGetRepository;
  }
}

function buildProvider(overrides = {}) {
  return {
    proveedor_pago_id: overrides.proveedor_pago_id || 1,
    clave: overrides.clave || "PAYPAL",
    nombre: overrides.nombre || "PayPal",
    tipo: overrides.tipo || "PAYPAL",
    activo: true,
    metadata_publica: null,
  };
}

function buildDonor(overrides = {}) {
  return {
    donante_id: overrides.donante_id || 1,
    nombre: overrides.nombre || "Jane",
    apellido: overrides.apellido || "Doe",
    email: overrides.email || "jane@example.com",
    telefono: overrides.telefono || "+56911111111",
    usuario_instagram: null,
  };
}

function buildPaymentOrder({
  orden_pago_id,
  proveedor_orden_id,
  donor = buildDonor(),
  payment_provider = buildProvider(),
  anonymous = false,
  estado = "CAPTURADA",
  monto_bruto = 10,
  moneda = "USD",
  createdAt = "2026-06-20T10:00:00.000Z",
  capturada_en = "2026-06-20T10:05:00.000Z",
  refund_summary = null,
  reversal_summary = null,
} = {}) {
  return {
    orden_pago_id,
    proveedor_orden_id,
    proposito: "DONACION_UNICA",
    moneda,
    monto_bruto,
    estado,
    approval_url: null,
    fecha_expiracion: null,
    capturada_en,
    payment_provider,
    donor: anonymous ? null : donor,
    metadata: {
      donor_identity_mode: anonymous ? "ANONYMOUS" : "IDENTIFIED",
      ...(refund_summary ? { refund_summary } : {}),
      ...(reversal_summary ? { reversal_summary } : {}),
      paypal: {
        order_id: proveedor_orden_id,
        capture_id: `CAPTURE-${orden_pago_id}`,
      },
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function buildCaptureTransaction({
  transaccion_id,
  order,
  donor = order?.donor || null,
  referencia_externa = `CAPTURE-${order?.orden_pago_id}`,
  monto_bruto = order?.monto_bruto || 10,
  monto_fee = 0.59,
  monto_neto = 9.41,
  fecha_transaccion = order?.capturada_en || "2026-06-20T10:05:00.000Z",
  estado = "CONFIRMADA",
} = {}) {
  return {
    transaccion_id,
    tipo: "INGRESO",
    descripcion: "Donacion unica PayPal",
    moneda: order?.moneda || "USD",
    monto_bruto,
    monto_fee,
    monto_neto,
    fecha_transaccion,
    estado,
    referencia_externa,
    idempotencia_key: `paypal:capture:${referencia_externa}`,
    metadata: {
      paypal_order_id: order?.proveedor_orden_id,
      paypal_capture_id: referencia_externa,
    },
    category: {
      categoria_transaccion_id: 10,
      clave: "DONACION_UNICA",
      nombre: "Donacion unica",
      tipo: "INGRESO",
    },
    payment_provider: order?.payment_provider,
    payment_order: {
      orden_pago_id: order?.orden_pago_id,
    },
    donor,
  };
}

function buildRefundTransaction({
  transaccion_id,
  order,
  refundId,
  monto_bruto = 5,
  fecha_transaccion = "2026-06-20T12:00:00.000Z",
} = {}) {
  return {
    transaccion_id,
    tipo: "EGRESO",
    descripcion: "Refund PayPal",
    moneda: order?.moneda || "USD",
    monto_bruto,
    monto_fee: 0.42,
    monto_neto: Number((monto_bruto - 0.42).toFixed(2)),
    fecha_transaccion,
    estado: "CONFIRMADA",
    referencia_externa: refundId,
    idempotencia_key: `paypal:refund:${refundId}`,
    metadata: {
      adjustment_type: "REFUND",
      paypal_refund_id: refundId,
      refund_fact_id: refundId,
      original_payment_order_id: order?.orden_pago_id,
    },
    category: {
      categoria_transaccion_id: 11,
      clave: "DEVOLUCION_DONACION",
      nombre: "Devolucion donacion",
      tipo: "EGRESO",
    },
    payment_provider: order?.payment_provider,
    payment_order: {
      orden_pago_id: order?.orden_pago_id,
    },
    donor: order?.donor || null,
  };
}

function buildReversalTransaction({
  transaccion_id,
  order,
  reversalId,
  monto_bruto = 10,
  fecha_transaccion = "2026-06-20T13:00:00.000Z",
} = {}) {
  return {
    transaccion_id,
    tipo: "EGRESO",
    descripcion: "Reversa PayPal",
    moneda: order?.moneda || "USD",
    monto_bruto,
    monto_fee: 0,
    monto_neto: monto_bruto,
    fecha_transaccion,
    estado: "CONFIRMADA",
    referencia_externa: reversalId,
    idempotencia_key: `paypal:reversal:${reversalId}`,
    metadata: {
      adjustment_type: "REVERSAL",
      reversal_fact_id: reversalId,
      original_payment_order_id: order?.orden_pago_id,
    },
    category: {
      categoria_transaccion_id: 12,
      clave: "REVERSA_PAYPAL",
      nombre: "Reversa PayPal",
      tipo: "EGRESO",
    },
    payment_provider: order?.payment_provider,
    payment_order: {
      orden_pago_id: order?.orden_pago_id,
    },
    donor: order?.donor || null,
  };
}

function buildStores() {
  const provider = buildProvider();
  const donor = buildDonor();
  const donorTwo = buildDonor({
    donante_id: 2,
    nombre: "Ana",
    apellido: "Lopez",
    email: "ana@example.com",
  });
  const orderOne = buildPaymentOrder({
    orden_pago_id: 1,
    proveedor_orden_id: "ORDER-1",
    payment_provider: provider,
    donor,
  });
  const orderTwo = buildPaymentOrder({
    orden_pago_id: 2,
    proveedor_orden_id: "ORDER-2",
    payment_provider: provider,
    donor,
    anonymous: true,
    createdAt: "2026-06-19T10:00:00.000Z",
    capturada_en: "2026-06-19T10:05:00.000Z",
  });
  const orderThree = buildPaymentOrder({
    orden_pago_id: 3,
    proveedor_orden_id: "ORDER-3",
    payment_provider: provider,
    donor: donorTwo,
    createdAt: "2026-06-18T10:00:00.000Z",
    capturada_en: "2026-06-18T10:05:00.000Z",
    refund_summary: {
      refund_ids: ["REFUND-3"],
      total_refunded: 3,
      remaining_amount: 7,
      fully_refunded: false,
      last_refund_id: "REFUND-3",
    },
  });
  const orderFour = buildPaymentOrder({
    orden_pago_id: 4,
    proveedor_orden_id: "ORDER-4",
    payment_provider: provider,
    donor: donorTwo,
    createdAt: "2026-06-17T10:00:00.000Z",
    capturada_en: "2026-06-17T10:05:00.000Z",
    refund_summary: {
      refund_ids: ["REFUND-4"],
      total_refunded: 10,
      remaining_amount: 0,
      fully_refunded: true,
      last_refund_id: "REFUND-4",
    },
  });
  const orderFive = buildPaymentOrder({
    orden_pago_id: 5,
    proveedor_orden_id: "ORDER-5",
    payment_provider: provider,
    donor,
    createdAt: "2026-06-16T10:00:00.000Z",
    capturada_en: "2026-06-16T10:05:00.000Z",
    reversal_summary: {
      reversal_fact_id: "REVERSAL-5",
      paypal_event_id: "WH-5",
    },
  });

  return {
    PaymentOrder: [orderOne, orderTwo, orderThree, orderFour, orderFive],
    Transaction: [
      buildCaptureTransaction({ transaccion_id: 101, order: orderOne, donor }),
      buildCaptureTransaction({ transaccion_id: 102, order: orderTwo, donor: null }),
      buildCaptureTransaction({ transaccion_id: 103, order: orderThree, donor: donorTwo }),
      buildRefundTransaction({ transaccion_id: 203, order: orderThree, refundId: "REFUND-3", monto_bruto: 3 }),
      buildCaptureTransaction({ transaccion_id: 104, order: orderFour, donor: donorTwo }),
      buildRefundTransaction({ transaccion_id: 204, order: orderFour, refundId: "REFUND-4", monto_bruto: 10 }),
      buildCaptureTransaction({ transaccion_id: 105, order: orderFive, donor }),
      buildReversalTransaction({ transaccion_id: 205, order: orderFive, reversalId: "REVERSAL-5" }),
    ],
  };
}

test("deriveDonationVisibleStatus prioriza reversal y refunds", () => {
  assert.equal(
    deriveDonationVisibleStatus({ estado: "CAPTURADA" }, {
      refundSummary: { refundStatus: "PARTIAL" },
      reversalSummary: { hasReversal: true },
    }),
    "REVERTIDA",
  );
  assert.equal(
    deriveDonationVisibleStatus({ estado: "CAPTURADA" }, {
      refundSummary: { refundStatus: "FULL" },
      reversalSummary: { hasReversal: false },
    }),
    "REEMBOLSADA_TOTAL",
  );
});

test("buildAccountingDonationItem incluye donor identificado", () => {
  const stores = buildStores();
  const item = buildAccountingDonationItem(stores.PaymentOrder[0], [stores.Transaction[0]]);

  assert.equal(item.donor.email, "jane@example.com");
  assert.equal(item.estado_visible, "CAPTURADA");
  assert.equal(item.estado_reembolso, "NONE");
});

test("buildAccountingDonationItem marca donacion anonima con donor null", () => {
  const stores = buildStores();
  const item = buildAccountingDonationItem(stores.PaymentOrder[1], [stores.Transaction[1]]);

  assert.equal(item.anonymous, true);
  assert.equal(item.donor, null);
});

test("getAccountingDonationsService lista donaciones capturadas", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result, error] = await getAccountingDonationsService({});

    assert.equal(error, null);
    assert.equal(result.items.length, 5);
    assert.equal(result.items[0].orden_pago_id, 1);
  });
});

test("dos donaciones del mismo donor aparecen como dos filas distintas", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ search: "jane@example.com" });

    assert.equal(result.items.length, 2);
    assert.deepEqual(result.items.map((item) => item.orden_pago_id), [1, 5]);
  });
});

test("replay de capture no duplica la fila de la donacion", async () => {
  const stores = buildStores();
  stores.Transaction.push(buildCaptureTransaction({
    transaccion_id: 106,
    order: stores.PaymentOrder[0],
    donor: stores.PaymentOrder[0].donor,
    referencia_externa: "CAPTURE-1",
    fecha_transaccion: "2026-06-20T10:05:00.000Z",
  }));

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ search: "ORDER-1" });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].orden_pago_id, 1);
  });
});

test("refund parcial no crea otra fila y expone estado parcial", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ status: "REEMBOLSADA_PARCIAL" });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].orden_pago_id, 3);
    assert.equal(result.items[0].total_reembolsado, 3);
  });
});

test("refund total no crea otra fila y expone estado total", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ refund_status: "FULL" });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].orden_pago_id, 4);
    assert.equal(result.items[0].estado_visible, "REEMBOLSADA_TOTAL");
  });
});

test("reversal no crea otra fila y expone estado revertida", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ refund_status: "REVERSED" });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].orden_pago_id, 5);
    assert.equal(result.items[0].reversal.tiene_reversa, true);
  });
});

test("matchesAccountingDonationFilters busca por email", () => {
  const stores = buildStores();
  const item = buildAccountingDonationItem(stores.PaymentOrder[0], [stores.Transaction[0]]);

  assert.equal(matchesAccountingDonationFilters(item, { search: "jane@example.com" }), true);
  assert.equal(matchesAccountingDonationFilters(item, { search: "ana@example.com" }), false);
});

test("getAccountingDonationsService busca por PayPal order ID", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ search: "ORDER-4" });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].orden_pago_id, 4);
  });
});

test("getAccountingDonationsService filtra anonimas", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [anonymousResult] = await getAccountingDonationsService({ anonymous: true });
    const [identifiedResult] = await getAccountingDonationsService({ anonymous: false });

    assert.equal(anonymousResult.items.length, 1);
    assert.equal(anonymousResult.items[0].orden_pago_id, 2);
    assert.equal(identifiedResult.items.length, 4);
  });
});

test("getAccountingDonationsService filtra por estado visible", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ status: "CAPTURADA" });

    assert.deepEqual(result.items.map((item) => item.orden_pago_id), [1, 2]);
  });
});

test("getAccountingDonationsService filtra por fecha principal", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({
      date_from: "2026-06-19",
      date_to: "2026-06-20",
    });

    assert.deepEqual(result.items.map((item) => item.orden_pago_id), [1, 2]);
  });
});

test("getAccountingDonationsService pagina resultados", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ page: 2, limit: 2 });

    assert.equal(result.pagination.total, 5);
    assert.deepEqual(result.items.map((item) => item.orden_pago_id), [3, 4]);
  });
});

test("sortAccountingDonations usa allowlist y ordena por donor_name asc", () => {
  const stores = buildStores();
  const items = stores.PaymentOrder.map((order) =>
    buildAccountingDonationItem(
      order,
      stores.Transaction.filter((transaction) => Number(transaction.payment_order.orden_pago_id) === Number(order.orden_pago_id)),
    ));
  const sorted = sortAccountingDonations(items, { sort_by: "donor_name", sort_order: "asc" });

  assert.deepEqual(sorted.slice(0, 2).map((item) => item.orden_pago_id), [4, 3]);
});

test("buildAccountingDonationSummary consolida montos por moneda", () => {
  const stores = buildStores();
  const items = stores.PaymentOrder.map((order) =>
    buildAccountingDonationItem(
      order,
      stores.Transaction.filter((transaction) => Number(transaction.payment_order.orden_pago_id) === Number(order.orden_pago_id)),
    ));

  const summary = buildAccountingDonationSummary(items);

  assert.equal(summary.by_currency.length, 1);
  assert.equal(summary.by_currency[0].moneda, "USD");
  assert.equal(summary.by_currency[0].cantidad_donaciones_confirmadas, 5);
});

test("buildAccountingDonationItem expone ventana de refund e historial sin duplicar la donacion", () => {
  const stores = buildStores();
  const order = stores.PaymentOrder.find((item) => Number(item.orden_pago_id) === 3);
  const transactions = stores.Transaction.filter(
    (transaction) => Number(transaction.payment_order.orden_pago_id) === 3,
  );

  const donation = buildAccountingDonationItem(order, transactions);

  assert.equal(typeof donation.reembolso_habilitado, "boolean");
  assert.equal(typeof donation.reembolso_dentro_de_plazo, "boolean");
  assert.ok(Array.isArray(donation.refund.historial));
  assert.equal(donation.refund.historial.length, 1);
  assert.equal(donation.refund.historial[0].paypal_refund_id, "REFUND-3");
});

test("la ruta de donaciones requiere accounting:payment_order:read", () => {
  const source = readFileSync(
    new URL("../../routes/financialConcept/accounting_donation.routes.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /checkRbac\("accounting:payment_order:read"\)/);
});

test("la ruta de refund administrativo requiere accounting:donation_refund:create", () => {
  const source = readFileSync(
    new URL("../../routes/financialConcept/accounting_donation.routes.js", import.meta.url),
    "utf8",
  );

  assert.match(source, /checkRbac\("accounting:donation_refund:create"\)/);
});

test("el listado no expone metadata sensible ni payloads crudos", async () => {
  const stores = buildStores();

  await withFakeAccountingContext(stores, async () => {
    const [result] = await getAccountingDonationsService({ search: "ORDER-1" });
    const donation = result.items[0];

    assert.equal("metadata" in donation, false);
    assert.equal("approval_url" in donation, false);
    assert.equal("payload" in donation, false);
    assert.equal("headers" in donation, false);
  });
});

"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNTING_REPORT_DEFAULT_INCLUDED_STATES,
  buildAccountingTransactionRow,
  classifyAccountingTransaction,
  getAccountingTransactionsReportExportService,
  getAccountingTransactionsReportPreviewService,
  resolveAccountingTransactionDirection,
  resolveAccountingTransactionOrigin,
  summarizeAccountingTransactions,
} from "./accounting_report.service.js";

function buildTransaction(overrides = {}) {
  return {
    transaccion_id: overrides.transaccion_id ?? 1,
    tipo: overrides.tipo ?? "INGRESO",
    estado: overrides.estado ?? "CONFIRMADA",
    descripcion: overrides.descripcion ?? "Operacion",
    moneda: overrides.moneda ?? "CLP",
    monto_bruto: overrides.monto_bruto ?? 100,
    monto_fee: overrides.monto_fee ?? 0,
    monto_neto: overrides.monto_neto ?? 100,
    fecha_transaccion: overrides.fecha_transaccion ?? "2026-06-23T15:00:00.000Z",
    origen_tipo: overrides.origen_tipo ?? null,
    referencia_externa: overrides.referencia_externa ?? null,
    metadata: overrides.metadata ?? null,
    category: overrides.category ?? null,
    payment_provider: overrides.payment_provider ?? null,
    payment_order: overrides.payment_order ?? null,
    payable_account: overrides.payable_account ?? null,
  };
}

class FakeQueryBuilder {
  constructor({
    total = 0,
    summaryRows = [],
    pageRows = [],
  } = {}) {
    this.total = total;
    this.summaryRows = summaryRows;
    this.pageRows = pageRows;
    this.andWhereCalls = [];
    this.orderByCalls = [];
    this.skipValue = undefined;
    this.takeValue = undefined;
  }

  leftJoinAndSelect() {
    return this;
  }

  andWhere(condition, params) {
    this.andWhereCalls.push({ condition, params });
    return this;
  }

  orderBy(column, direction) {
    this.orderByCalls.push({ column, direction });
    return this;
  }

  addOrderBy(column, direction) {
    this.orderByCalls.push({ column, direction });
    return this;
  }

  skip(value) {
    this.skipValue = value;
    return this;
  }

  take(value) {
    this.takeValue = value;
    return this;
  }

  clone() {
    const cloned = new FakeQueryBuilder({
      total: this.total,
      summaryRows: this.summaryRows,
      pageRows: this.pageRows,
    });
    cloned.andWhereCalls = [...this.andWhereCalls];
    cloned.orderByCalls = [...this.orderByCalls];
    return cloned;
  }

  async getCount() {
    return this.total;
  }

  async getMany() {
    if (this.skipValue !== undefined || this.takeValue !== undefined) {
      return this.pageRows;
    }

    return this.summaryRows;
  }
}

test("classifyAccountingTransaction clasifica refund y reversal con señales reales", () => {
  const refund = buildTransaction({
    tipo: "EGRESO",
    category: { clave: "DEVOLUCION_DONACION" },
  });
  const reversal = buildTransaction({
    tipo: "EGRESO",
    metadata: { adjustment_type: "REVERSAL" },
  });

  assert.equal(classifyAccountingTransaction(refund), "REFUND");
  assert.equal(classifyAccountingTransaction(reversal), "REVERSAL");
});

test("classifyAccountingTransaction marca FEE sin descontar dos veces el neto", () => {
  const feeTransaction = buildTransaction({
    tipo: "INGRESO",
    monto_bruto: 100,
    monto_fee: 10,
    monto_neto: 90,
  });

  assert.equal(classifyAccountingTransaction(feeTransaction), "FEE");

  const { summary } = summarizeAccountingTransactions([feeTransaction]);
  assert.equal(summary.monedas.CLP.fees, 10);
  assert.equal(summary.monedas.CLP.resultado_neto, 90);
});

test("resolveAccountingTransactionDirection usa tipo real y categoria para AJUSTE", () => {
  assert.equal(resolveAccountingTransactionDirection(buildTransaction({ tipo: "INGRESO" })), 1);
  assert.equal(resolveAccountingTransactionDirection(buildTransaction({ tipo: "EGRESO" })), -1);
  assert.equal(
    resolveAccountingTransactionDirection(buildTransaction({
      tipo: "AJUSTE",
      category: { tipo: "EGRESO" },
    })),
    -1,
  );
  assert.equal(
    resolveAccountingTransactionDirection(buildTransaction({
      tipo: "AJUSTE",
      category: { tipo: "AMBOS" },
    })),
    null,
  );
});

test("resolveAccountingTransactionOrigin prioriza origen real de la transaccion y luego payable", () => {
  assert.equal(
    resolveAccountingTransactionOrigin(buildTransaction({ origen_tipo: "PAYPAL_DONATION_CAPTURE" })),
    "PAYPAL_DONATION_CAPTURE",
  );
  assert.equal(
    resolveAccountingTransactionOrigin(buildTransaction({
      payable_account: { origen_tipo: "PURCHASE" },
    })),
    "PURCHASE",
  );
});

test("buildAccountingTransactionRow expone DTO minimo y seguro", () => {
  const row = buildAccountingTransactionRow(buildTransaction({
    transaccion_id: 44,
    tipo: "INGRESO",
    estado: "CONFIRMADA",
    payment_provider: {
      proveedor_pago_id: 7,
      clave: "PAYPAL",
      nombre: "PayPal",
      tipo: "PAYPAL",
    },
    category: {
      categoria_transaccion_id: 9,
      clave: "DONACION_UNICA",
      nombre: "Donacion unica",
      tipo: "INGRESO",
    },
  }));

  assert.equal(row.id, 44);
  assert.equal(row.proveedor_pago.nombre, "PayPal");
  assert.equal(row.categoria.clave, "DONACION_UNICA");
  assert.equal(row.payment_order, undefined);
  assert.equal(row.metadata, undefined);
});

test("summarizeAccountingTransactions separa monedas,categoríasy warnings", () => {
  const transactions = [
    buildTransaction({
      transaccion_id: 1,
      tipo: "INGRESO",
      moneda: "CLP",
      monto_bruto: 100,
      monto_fee: 10,
      monto_neto: 90,
      category: {
        categoria_transaccion_id: 1,
        nombre: "Donacion unica",
        clave: "DONACION_UNICA",
        tipo: "INGRESO",
      },
      origen_tipo: "PAYPAL_DONATION_CAPTURE",
    }),
    buildTransaction({
      transaccion_id: 2,
      tipo: "EGRESO",
      moneda: "USD",
      monto_bruto: 25,
      monto_fee: 0,
      monto_neto: 25,
      category: {
        categoria_transaccion_id: 2,
        nombre: "Devolucion donacion",
        clave: "DEVOLUCION_DONACION",
        tipo: "EGRESO",
      },
      origen_tipo: "PAYPAL_DONATION_REFUND",
    }),
    buildTransaction({
      transaccion_id: 3,
      tipo: "AJUSTE",
      moneda: "CLP",
      monto_bruto: 10,
      monto_fee: 0,
      monto_neto: 10,
      category: null,
      origen_tipo: null,
    }),
  ];

  const { summary, warnings } = summarizeAccountingTransactions(transactions);

  assert.equal(summary.operaciones_totales, 3);
  assert.equal(summary.monedas.CLP.ingresos_brutos, 100);
  assert.equal(summary.monedas.CLP.resultado_neto, 90);
  assert.equal(summary.monedas.USD.refunds, 25);
  assert.equal(summary.categorias.length, 3);
  assert.ok(warnings.some((warning) => /multiples monedas/i.test(warning)));
  assert.ok(warnings.some((warning) => /sin categoria/i.test(warning)));
});

test("getAccountingTransactionsReportPreviewService usa count global y pagina sin alterar resumen", async () => {
  const summaryRows = [
    buildTransaction({
      transaccion_id: 100,
      tipo: "INGRESO",
      monto_bruto: 200,
      monto_fee: 20,
      monto_neto: 180,
      category: {
        categoria_transaccion_id: 1,
        nombre: "Donacion unica",
        clave: "DONACION_UNICA",
        tipo: "INGRESO",
      },
      origen_tipo: "PAYPAL_DONATION_CAPTURE",
    }),
    buildTransaction({
      transaccion_id: 99,
      tipo: "EGRESO",
      monto_bruto: 50,
      monto_fee: 0,
      monto_neto: 50,
      category: {
        categoria_transaccion_id: 2,
        nombre: "Devolucion donacion",
        clave: "DEVOLUCION_DONACION",
        tipo: "EGRESO",
      },
      origen_tipo: "PAYPAL_DONATION_REFUND",
    }),
  ];
  const pageRows = [summaryRows[0]];
  const fakeBuilder = new FakeQueryBuilder({
    total: 2,
    summaryRows,
    pageRows,
  });
  const fakeRepository = {
    createQueryBuilder() {
      return fakeBuilder;
    },
  };

  const [report, error] = await getAccountingTransactionsReportPreviewService(
    {
      page: 1,
      limit: 1,
      moneda: "CLP",
      tipo: "INGRESO",
      estado: "",
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-23",
      search: "donacion",
    },
    {
      user: {
        id_usuario: 10,
        nombre: "Ana",
        apellido: "Perez",
      },
    },
    {
      repository: fakeRepository,
      now: new Date("2026-06-23T15:00:00.000Z"),
    },
  );

  assert.equal(error, null);
  assert.equal(report.pagination.total, 2);
  assert.equal(report.rows.length, 1);
  assert.equal(report.summary.operaciones_totales, 2);
  assert.equal(report.summary.monedas.CLP.resultado_neto, 130);
  assert.equal(report.summary.monedas.CLP.fees, 20);
  assert.equal(report.summary.monedas.CLP.refunds, 50);
  assert.deepEqual(report.generated_by, {
    id: 10,
    name: "Ana Perez",
  });
  assert.deepEqual(report.filters.estados_por_defecto, ACCOUNTING_REPORT_DEFAULT_INCLUDED_STATES);
  assert.ok(
    fakeBuilder.andWhereCalls.some((call) => String(call.condition).includes("transaction.moneda")),
  );
  assert.ok(
    fakeBuilder.andWhereCalls.some((call) => String(call.condition).includes("transaction.tipo")),
  );
});

test("getAccountingTransactionsReportPreviewService devuelve preview vacio sin fallar", async () => {
  const fakeRepository = {
    createQueryBuilder() {
      return new FakeQueryBuilder({
        total: 0,
        summaryRows: [],
        pageRows: [],
      });
    },
  };

  const [report, error] = await getAccountingTransactionsReportPreviewService(
    {},
    {},
    {
      repository: fakeRepository,
      now: new Date("2026-06-23T15:00:00.000Z"),
    },
  );

  assert.equal(error, null);
  assert.equal(report.rows.length, 0);
  assert.equal(report.summary.operaciones_totales, 0);
});

test("getAccountingTransactionsReportExportService conserva el resumen del preview y no pagina filas", async () => {
  const summaryRows = [
    buildTransaction({ transaccion_id: 100, monto_bruto: 200, monto_neto: 180, monto_fee: 20 }),
    buildTransaction({ transaccion_id: 99, tipo: "EGRESO", monto_bruto: 50, monto_neto: 50 }),
  ];
  const fakeRepository = {
    createQueryBuilder() {
      return new FakeQueryBuilder({
        total: 2,
        summaryRows,
        pageRows: [summaryRows[0]],
      });
    },
  };

  const [preview] = await getAccountingTransactionsReportPreviewService(
    { page: 1, limit: 1, fecha_desde: "2026-06-01", fecha_hasta: "2026-06-23" },
    { user: { id_usuario: 10, nombre: "Ana", apellido: "Perez" } },
    { repository: fakeRepository, now: new Date("2026-06-23T15:00:00.000Z") },
  );
  const [report, error] = await getAccountingTransactionsReportExportService(
    { format: "xlsx", fecha_desde: "2026-06-01", fecha_hasta: "2026-06-23" },
    { user: { id_usuario: 10, nombre: "Ana", apellido: "Perez" } },
    { repository: fakeRepository, now: new Date("2026-06-23T15:00:00.000Z") },
  );

  assert.equal(error, null);
  assert.deepEqual(report.summary, preview.summary);
  assert.equal(preview.rows.length, 1);
  assert.equal(report.rows.length, 2);
});

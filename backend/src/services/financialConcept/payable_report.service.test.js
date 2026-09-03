"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPayableReportRow,
  derivePayableReportState,
  getPayablesReportExportService,
  getPayablesReportPreviewService,
  isPayableOverdue,
  resolvePayableCounterparty,
  resolvePayableOrigin,
  summarizePayables,
} from "./payable_report.service.js";

function buildPayable(overrides = {}) {
  return {
    cuenta_por_pagar_id: overrides.cuenta_por_pagar_id ?? 1,
    origen_tipo: Object.prototype.hasOwnProperty.call(overrides, "origen_tipo")
      ? overrides.origen_tipo
      : "PURCHASE",
    origen_id: Object.prototype.hasOwnProperty.call(overrides, "origen_id")
      ? overrides.origen_id
      : 10,
    proveedor_tipo: Object.prototype.hasOwnProperty.call(overrides, "proveedor_tipo")
      ? overrides.proveedor_tipo
      : "SUPPLIER",
    proveedor_id: Object.prototype.hasOwnProperty.call(overrides, "proveedor_id")
      ? overrides.proveedor_id
      : 5,
    descripcion: overrides.descripcion ?? "Compra proveedor",
    moneda: overrides.moneda ?? "CLP",
    monto_total: overrides.monto_total ?? 100,
    monto_pagado: overrides.monto_pagado ?? 0,
    saldo_pendiente: overrides.saldo_pendiente ?? 100,
    fecha_emision: overrides.fecha_emision ?? "2026-06-01",
    fecha_vencimiento: overrides.fecha_vencimiento ?? "2026-06-30",
    estado: overrides.estado ?? "PENDIENTE",
    category: overrides.category ?? null,
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

  orderBy(column, direction, nulls) {
    this.orderByCalls.push({ column, direction, nulls });
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

test("derivePayableReportState detecta vencida y cuenta que vence hoy no esta vencida", () => {
  const overdue = buildPayable({
    fecha_vencimiento: "2026-06-22",
  });
  const dueToday = buildPayable({
    fecha_vencimiento: "2026-06-23",
  });

  assert.equal(derivePayableReportState(overdue, "2026-06-23"), "VENCIDA");
  assert.equal(derivePayableReportState(dueToday, "2026-06-23"), "PENDIENTE");
  assert.equal(isPayableOverdue(dueToday, "2026-06-23"), false);
});

test("resolvePayableCounterparty y resolvePayableOrigin usan campos reales", () => {
  const payable = buildPayable({
    proveedor_tipo: "VET_CLINIC",
    proveedor_id: 77,
    origen_tipo: "EXAM",
    origen_id: 45,
  });

  const counterparty = resolvePayableCounterparty(payable, {
    clinicsById: new Map([[77, { nombre: "Clinica Central" }]]),
  });
  const origin = resolvePayableOrigin(payable);

  assert.deepEqual(counterparty, {
    tipo: "VET_CLINIC",
    id: 77,
    nombre: "Clinica Central",
  });
  assert.deepEqual(origin, {
    tipo: "EXAM",
    id_visible: "45",
    descripcion: "Examen #45",
  });
});

test("buildPayableReportRow expone DTO compacto y agregado de pagos", () => {
  const row = buildPayableReportRow(
    buildPayable({
      cuenta_por_pagar_id: 20,
      monto_pagado: 40,
      saldo_pendiente: 60,
      category: {
        categoria_transaccion_id: 9,
        clave: "COMPRA_INSUMOS",
        nombre: "Compra insumos",
      },
    }),
    {
      chileDate: "2026-06-23",
      paymentAggregatesById: new Map([
        [20, {
          cantidad_pagos: 2,
          ultima_fecha_pago: "2026-06-20",
          monto_pagado_calculado: 40,
        }],
      ]),
      suppliersById: new Map([[5, { nombre: "Proveedor Uno" }]]),
      clinicsById: new Map(),
    },
  );

  assert.equal(row.id, 20);
  assert.equal(row.categoria.nombre, "Compra insumos");
  assert.equal(row.pagos.cantidad, 2);
  assert.equal(row.contraparte.nombre, "Proveedor Uno");
});

test("summarizePayables separa monedas, vencidas y anuladas sin doble conteo", () => {
  const payables = [
    buildPayable({
      cuenta_por_pagar_id: 1,
      monto_total: 100,
      monto_pagado: 0,
      saldo_pendiente: 100,
      fecha_vencimiento: "2026-06-20",
      category: { categoria_transaccion_id: 1, clave: "COMPRA_INSUMOS", nombre: "Compra insumos" },
    }),
    buildPayable({
      cuenta_por_pagar_id: 2,
      moneda: "USD",
      monto_total: 50,
      monto_pagado: 20,
      saldo_pendiente: 30,
      fecha_vencimiento: null,
      category: { categoria_transaccion_id: 2, clave: "GASTO_VETERINARIO", nombre: "Gasto veterinario" },
      proveedor_tipo: "VET_CLINIC",
      proveedor_id: 7,
      origen_tipo: "EXAM",
      origen_id: 11,
    }),
    buildPayable({
      cuenta_por_pagar_id: 3,
      estado: "ANULADA",
      monto_total: 80,
      monto_pagado: 0,
      saldo_pendiente: 80,
      fecha_vencimiento: "2026-06-10",
      proveedor_tipo: null,
      proveedor_id: null,
      origen_tipo: null,
      origen_id: null,
      category: null,
    }),
  ];

  const { summary, warnings } = summarizePayables(payables, {
    chileDate: "2026-06-23",
    paymentAggregatesById: new Map(),
    suppliersById: new Map([[5, { nombre: "Proveedor Uno" }]]),
    clinicsById: new Map([[7, { nombre: "Clinica Uno" }]]),
  });

  assert.equal(summary.cuentas_totales, 3);
  assert.equal(summary.monedas.CLP.obligaciones_total, 100);
  assert.equal(summary.monedas.CLP.saldo_vencido, 100);
  assert.equal(summary.monedas.CLP.anuladas, 1);
  assert.equal(summary.monedas.USD.parciales, 1);
  assert.ok(warnings.some((warning) => /sin categoria/i.test(warning)));
  assert.ok(warnings.some((warning) => /sin origen/i.test(warning)));
});

test("getPayablesReportPreviewService mantiene resumen global y pagina parcial", async () => {
  const summaryRows = [
    buildPayable({
      cuenta_por_pagar_id: 10,
      monto_total: 100,
      monto_pagado: 30,
      saldo_pendiente: 70,
      fecha_vencimiento: "2026-06-25",
      category: {
        categoria_transaccion_id: 1,
        clave: "COMPRA_INSUMOS",
        nombre: "Compra insumos",
      },
    }),
    buildPayable({
      cuenta_por_pagar_id: 9,
      moneda: "USD",
      proveedor_tipo: "VET_CLINIC",
      proveedor_id: 8,
      origen_tipo: "EXAM",
      origen_id: 19,
      monto_total: 50,
      monto_pagado: 0,
      saldo_pendiente: 50,
      fecha_vencimiento: "2026-06-21",
      category: {
        categoria_transaccion_id: 2,
        clave: "GASTO_VETERINARIO",
        nombre: "Gasto veterinario",
      },
    }),
  ];
  const fakeBuilder = new FakeQueryBuilder({
    total: 2,
    summaryRows,
    pageRows: [summaryRows[0]],
  });
  const fakeRepository = {
    createQueryBuilder() {
      return fakeBuilder;
    },
  };

  const [report, error] = await getPayablesReportPreviewService(
    {
      page: 1,
      limit: 1,
      con_saldo: true,
      solo_vencidas: false,
      moneda: "CLP",
      estado: "",
      fecha_emision_desde: "2026-06-01",
      fecha_emision_hasta: "2026-06-23",
      search: "proveedor",
    },
    {
      user: {
        id_usuario: 5,
        nombre: "Ana",
        apellido: "Perez",
      },
    },
    {
      repository: fakeRepository,
      now: new Date("2026-06-23T15:00:00.000Z"),
      paymentAggregatesLoader: async () => new Map([
        [10, {
          cantidad_pagos: 1,
          ultima_fecha_pago: "2026-06-15",
          monto_pagado_calculado: 30,
        }],
        [9, {
          cantidad_pagos: 0,
          ultima_fecha_pago: null,
          monto_pagado_calculado: 0,
        }],
      ]),
      counterpartyLookupLoader: async () => ({
        suppliersById: new Map([[5, { nombre: "Proveedor Uno" }]]),
        clinicsById: new Map([[8, { nombre: "Clinica Uno" }]]),
      }),
      searchMatchesLoader: async () => ({
        supplierIds: [5],
        clinicIds: [],
      }),
    },
  );

  assert.equal(error, null);
  assert.equal(report.pagination.total, 2);
  assert.equal(report.rows.length, 1);
  assert.equal(report.summary.cuentas_totales, 2);
  assert.equal(report.summary.monedas.CLP.obligaciones_total, 100);
  assert.equal(report.summary.monedas.USD.vencidas, 1);
  assert.deepEqual(report.generated_by, {
    id: 5,
    name: "Ana Perez",
  });
  assert.ok(
    fakeBuilder.andWhereCalls.some((call) => String(call.condition).includes("payable.moneda")),
  );
  assert.ok(
    fakeBuilder.andWhereCalls.some((call) => String(call.condition).includes("payable.saldo_pendiente > 0")),
  );
});

test("getPayablesReportPreviewService devuelve preview vacio sin error", async () => {
  const fakeRepository = {
    createQueryBuilder() {
      return new FakeQueryBuilder({
        total: 0,
        summaryRows: [],
        pageRows: [],
      });
    },
  };

  const [report, error] = await getPayablesReportPreviewService(
    {},
    {},
    {
      repository: fakeRepository,
      now: new Date("2026-06-23T15:00:00.000Z"),
      paymentAggregatesLoader: async () => new Map(),
      counterpartyLookupLoader: async () => ({
        suppliersById: new Map(),
        clinicsById: new Map(),
      }),
    },
  );

  assert.equal(error, null);
  assert.equal(report.rows.length, 0);
  assert.equal(report.summary.cuentas_totales, 0);
});

test("getPayablesReportExportService conserva el resumen del preview y expone pagos completos", async () => {
  const summaryRows = [
    buildPayable({ cuenta_por_pagar_id: 10, monto_total: 100, monto_pagado: 30, saldo_pendiente: 70 }),
    buildPayable({ cuenta_por_pagar_id: 9, monto_total: 50, monto_pagado: 0, saldo_pendiente: 50 }),
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
  const dependencies = {
    repository: fakeRepository,
    now: new Date("2026-06-23T15:00:00.000Z"),
    paymentAggregatesLoader: async () => new Map([
      [10, { cantidad_pagos: 1, ultima_fecha_pago: "2026-06-15", monto_pagado_calculado: 30 }],
      [9, { cantidad_pagos: 0, ultima_fecha_pago: null, monto_pagado_calculado: 0 }],
    ]),
    paymentRowsLoader: async () => [
      {
        payment_id: 1,
        payable_id: 10,
        fecha_pago: "2026-06-15",
        monto_aplicado: 30,
        proveedor_pago: { nombre: "Caja" },
        referencia_segura: "REF-1",
      },
    ],
    counterpartyLookupLoader: async () => ({
      suppliersById: new Map([[5, { nombre: "Proveedor Uno" }]]),
      clinicsById: new Map(),
    }),
  };

  const [preview] = await getPayablesReportPreviewService(
    { page: 1, limit: 1 },
    { user: { id_usuario: 5, nombre: "Ana", apellido: "Perez" } },
    dependencies,
  );
  const [report, error] = await getPayablesReportExportService(
    { format: "pdf" },
    { user: { id_usuario: 5, nombre: "Ana", apellido: "Perez" } },
    dependencies,
  );

  assert.equal(error, null);
  assert.deepEqual(report.summary, preview.summary);
  assert.equal(preview.rows.length, 1);
  assert.equal(report.rows.length, 2);
  assert.equal(report.payments.length, 1);
});

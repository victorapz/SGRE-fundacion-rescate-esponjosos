"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInventoryExistenceReportRow,
  classifyInventoryExistence,
  getInventoryExistencesReportExportService,
  getInventoryExistencesReportPreviewService,
  summarizeInventoryExistenceRows,
} from "./inventory_existence_report.service.js";

function buildRawRow(overrides = {}) {
  return {
    existence_id: overrides.existence_id ?? 1,
    item_id: overrides.item_id ?? 10,
    item_nombre: overrides.item_nombre ?? "Alimento premium",
    item_activo: overrides.item_activo ?? true,
    categoria_item_id: overrides.categoria_item_id ?? 3,
    categoria_nombre: overrides.categoria_nombre ?? "Alimentos",
    unidad_medida_id: overrides.unidad_medida_id ?? 2,
    unidad_nombre: overrides.unidad_nombre ?? "kg",
    unidad_activa: overrides.unidad_activa ?? true,
    ubicacion_id: overrides.ubicacion_id ?? 7,
    ubicacion_nombre: overrides.ubicacion_nombre ?? "Bodega Central",
    ubicacion_tipo: overrides.ubicacion_tipo ?? "BODEGA",
    ubicacion_activa: overrides.ubicacion_activa ?? true,
    cantidad_actual: overrides.cantidad_actual ?? 10,
    stock_minimo: overrides.stock_minimo ?? 5,
    actualizado_en: overrides.actualizado_en ?? "2026-06-23T12:00:00.000Z",
    persistence_rows: overrides.persistence_rows ?? 1,
    distinct_estado_count: overrides.distinct_estado_count ?? 1,
    distinct_condicion_count: overrides.distinct_condicion_count ?? 1,
    distinct_origen_tipo_count: overrides.distinct_origen_tipo_count ?? 1,
    distinct_fecha_vencimiento_count: overrides.distinct_fecha_vencimiento_count ?? 1,
    distinct_fecha_apertura_count: overrides.distinct_fecha_apertura_count ?? 1,
  };
}

class FakeQueryBuilder {
  constructor({ rows = [], total = 0 } = {}) {
    this.rows = rows;
    this.total = total;
    this.andWhereCalls = [];
    this.havingCalls = [];
    this.orderByCalls = [];
    this.offsetValue = undefined;
    this.limitValue = undefined;
  }

  leftJoin() {
    return this;
  }

  select() {
    return this;
  }

  addSelect() {
    return this;
  }

  groupBy() {
    return this;
  }

  addGroupBy() {
    return this;
  }

  andWhere(condition, params) {
    this.andWhereCalls.push({ condition, params });
    return this;
  }

  having(condition, params) {
    this.havingCalls = [{ condition, params }];
    return this;
  }

  andHaving(condition, params) {
    this.havingCalls.push({ condition, params });
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

  offset(value) {
    this.offsetValue = value;
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  clone() {
    const cloned = new FakeQueryBuilder({
      rows: this.rows,
      total: this.total,
    });
    cloned.andWhereCalls = [...this.andWhereCalls];
    cloned.havingCalls = [...this.havingCalls];
    cloned.orderByCalls = [...this.orderByCalls];
    return cloned;
  }

  getQuery() {
    return "SELECT * FROM fake_existences";
  }

  getParameters() {
    return {};
  }

  async getRawMany() {
    if (this.offsetValue !== undefined || this.limitValue !== undefined) {
      return this.rows.slice(this.offsetValue || 0, (this.offsetValue || 0) + (this.limitValue || this.rows.length));
    }

    return this.rows;
  }
}

test("classifyInventoryExistence usa la regla real de minimo estricto", () => {
  assert.equal(classifyInventoryExistence({ quantity: 0, minimumStock: 5 }), "SIN_STOCK");
  assert.equal(classifyInventoryExistence({ quantity: -2, minimumStock: 5 }), "SIN_STOCK");
  assert.equal(classifyInventoryExistence({ quantity: 4, minimumStock: 5 }), "BAJO_MINIMO");
  assert.equal(classifyInventoryExistence({ quantity: 5, minimumStock: 5 }), "DISPONIBLE");
  assert.equal(classifyInventoryExistence({ quantity: 8, minimumStock: null }), "DISPONIBLE");
});

test("buildInventoryExistenceReportRow ajusta DTO a campos reales sin codigo ni abreviatura", () => {
  const row = buildInventoryExistenceReportRow(buildRawRow({
    cantidad_actual: "3.5",
    stock_minimo: "5",
    persistence_rows: 3,
    distinct_estado_count: 2,
    distinct_condicion_count: 1,
    distinct_origen_tipo_count: 1,
    distinct_fecha_vencimiento_count: 2,
    distinct_fecha_apertura_count: 1,
  }));

  assert.equal(row.item.codigo, null);
  assert.equal(row.unidad.abreviatura, null);
  assert.equal(row.cantidad_actual, 3.5);
  assert.equal(row.stock_minimo, 5);
  assert.equal(row.diferencia_minimo, -1.5);
  assert.equal(row.estado_stock, "BAJO_MINIMO");
  assert.deepEqual(row.aggregation, {
    persistence_rows: 3,
    heterogeneous: true,
    mixed_fields: ["estado", "fecha_vencimiento"],
  });
});

test("summarizeInventoryExistenceRows separa estados, unidades y warnings", () => {
  const rows = [
    buildRawRow({
      existence_id: 1,
      cantidad_actual: 0,
      stock_minimo: 5,
      persistence_rows: 2,
    }),
    buildRawRow({
      existence_id: 2,
      item_id: 11,
      item_nombre: "Medicamento X",
      unidad_nombre: "unidad",
      unidad_medida_id: 3,
      cantidad_actual: 2,
      stock_minimo: 5,
      ubicacion_id: 8,
      ubicacion_nombre: "Clinica Norte",
      categoria_nombre: "Medicamentos",
      categoria_item_id: 4,
      item_activo: false,
    }),
    buildRawRow({
      existence_id: 3,
      item_id: 12,
      item_nombre: "Correa",
      unidad_nombre: "unidad",
      unidad_medida_id: 3,
      cantidad_actual: 8,
      stock_minimo: null,
      ubicacion_id: 9,
      ubicacion_nombre: "Bodega Sur",
      categoria_nombre: "Accesorios",
      categoria_item_id: 5,
      ubicacion_activa: false,
    }),
  ];

  const { summary, warnings } = summarizeInventoryExistenceRows(rows);

  assert.equal(summary.existencias_totales, 3);
  assert.equal(summary.items_distintos, 3);
  assert.equal(summary.ubicaciones_distintas, 3);
  assert.equal(summary.sin_stock, 1);
  assert.equal(summary.bajo_minimo, 1);
  assert.equal(summary.disponibles, 1);
  assert.equal(summary.cantidades_por_unidad.length, 2);
  assert.ok(warnings.some((warning) => /multiples filas persistidas/i.test(warning)));
  assert.ok(warnings.some((warning) => /items inactivos/i.test(warning)));
  assert.ok(warnings.some((warning) => /ubicaciones inactivas/i.test(warning)));
});

test("summarizeInventoryExistenceRows distingue fila unica, multiples homogeneas y multiples heterogeneas", () => {
  const rows = [
    buildRawRow({
      existence_id: 1,
      persistence_rows: 1,
      distinct_estado_count: 1,
      distinct_condicion_count: 1,
      distinct_origen_tipo_count: 1,
      distinct_fecha_vencimiento_count: 1,
      distinct_fecha_apertura_count: 1,
    }),
    buildRawRow({
      existence_id: 2,
      item_id: 11,
      item_nombre: "Homogeneo",
      persistence_rows: 3,
      distinct_estado_count: 1,
      distinct_condicion_count: 1,
      distinct_origen_tipo_count: 1,
      distinct_fecha_vencimiento_count: 1,
      distinct_fecha_apertura_count: 1,
    }),
    buildRawRow({
      existence_id: 3,
      item_id: 12,
      item_nombre: "Heterogeneo",
      persistence_rows: 2,
      distinct_estado_count: 2,
      distinct_condicion_count: 1,
      distinct_origen_tipo_count: 2,
      distinct_fecha_vencimiento_count: 1,
      distinct_fecha_apertura_count: 2,
    }),
  ];

  const mappedRows = rows.map(buildInventoryExistenceReportRow);
  assert.equal(mappedRows[0].aggregation.heterogeneous, false);
  assert.equal(mappedRows[1].aggregation.heterogeneous, false);
  assert.equal(mappedRows[2].aggregation.heterogeneous, true);
  assert.deepEqual(
    mappedRows[2].aggregation.mixed_fields,
    ["estado", "origen_tipo", "fecha_apertura"],
  );

  const { warnings } = summarizeInventoryExistenceRows(rows);
  assert.ok(warnings.some((warning) => /multiples filas persistidas/i.test(warning)));
  assert.ok(warnings.some((warning) => /heterogeneidad real/i.test(warning)));
});

test("getInventoryExistencesReportPreviewService mantiene resumen global y pagina parcial", async () => {
  const rows = [
    buildRawRow({
      existence_id: 1,
      cantidad_actual: 0,
      stock_minimo: 5,
    }),
    buildRawRow({
      existence_id: 2,
      item_id: 11,
      item_nombre: "Medicamento X",
      ubicacion_id: 8,
      ubicacion_nombre: "Clinica Norte",
      cantidad_actual: 2,
      stock_minimo: 5,
    }),
    buildRawRow({
      existence_id: 3,
      item_id: 12,
      item_nombre: "Correa",
      ubicacion_id: 9,
      ubicacion_nombre: "Bodega Sur",
      cantidad_actual: 8,
      stock_minimo: null,
    }),
  ];
  const fakeBuilder = new FakeQueryBuilder({
    rows,
    total: 3,
  });
  const fakeRepository = {
    createQueryBuilder() {
      return fakeBuilder;
    },
  };
  const fakeDataSourceBuilder = {
    select() {
      return this;
    },
    from() {
      return this;
    },
    setParameters() {
      return this;
    },
    async getRawOne() {
      return { total: 3 };
    },
  };

  const [report, error] = await getInventoryExistencesReportPreviewService(
    {
      page: 1,
      limit: 2,
      categoria_id: 3,
      estado_stock: "SIN_STOCK",
      activo: true,
      search: "bodega",
    },
    {
      user: {
        id_usuario: 6,
        nombre: "Ana",
        apellido: "Perez",
      },
    },
    {
      repository: fakeRepository,
      scope: { mode: "global", userLocationId: null },
      manager: {},
      totalCountLoader: async () => 3,
    },
  );

  assert.equal(error, null);
  assert.equal(report.pagination.total, 3);
  assert.equal(report.rows.length, 2);
  assert.equal(report.summary.existencias_totales, 3);
  assert.equal(report.summary.sin_stock, 1);
  assert.deepEqual(report.generated_by, {
    id: 6,
    name: "Ana Perez",
  });
  assert.ok(
    fakeBuilder.andWhereCalls.some((call) => String(call.condition).includes("category.categoria_item_id")),
  );
  assert.ok(fakeBuilder.havingCalls.length > 0);
});

test("getInventoryExistencesReportExportService conserva el resumen del preview y no pagina filas", async () => {
  const rows = [
    buildRawRow({ existence_id: 1 }),
    buildRawRow({ existence_id: 2, item_id: 11, item_nombre: "Vacuna", ubicacion_id: 8 }),
  ];
  const fakeBuilder = new FakeQueryBuilder({ rows, total: 2 });
  const fakeRepository = {
    createQueryBuilder() {
      return fakeBuilder;
    },
  };
  const deps = {
    repository: fakeRepository,
    scope: { mode: "global", userLocationId: null },
    manager: {},
    totalCountLoader: async () => 2,
  };

  const [preview] = await getInventoryExistencesReportPreviewService(
    { page: 1, limit: 1 },
    { user: { id_usuario: 6, nombre: "Ana", apellido: "Perez" } },
    deps,
  );
  const [report, error] = await getInventoryExistencesReportExportService(
    { format: "xlsx" },
    { user: { id_usuario: 6, nombre: "Ana", apellido: "Perez" } },
    deps,
  );

  assert.equal(error, null);
  assert.deepEqual(report.summary, preview.summary);
  assert.equal(preview.rows.length, 1);
  assert.equal(report.rows.length, 2);
});

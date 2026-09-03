"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPhysicalCountDifference,
  getInventoryCountsAdjustmentsReportExportService,
  getInventoryCountsAdjustmentsReportPreviewService,
  PHYSICAL_COUNT_DATA_QUALITY,
  resolveAdjustmentImpact,
} from "./inventory_counts_adjustments_report.service.js";

function buildItem({
  item_id = 10,
  nombre = "Alimento",
  categoria_item_id = 3,
  nombre_categoria = "Categoria",
  unidad_medida_id = 2,
  unidad_nombre = "kg",
} = {}) {
  return {
    item_id,
    nombre,
    categoria: {
      categoria_item_id,
      nombre_categoria,
    },
    unidad_medida: {
      unidad_medida_id,
      nombre: unidad_nombre,
    },
  };
}

function buildLocation({
  ubicacion_id = 7,
  nombre_ubicacion = "Bodega Central",
  tipo = "BODEGA",
} = {}) {
  return {
    ubicacion_id,
    nombre_ubicacion,
    tipo,
  };
}

function buildUser({
  id_usuario = 5,
  nombre = "Ana",
  apellido = "Perez",
} = {}) {
  return {
    id_usuario,
    nombre,
    apellido,
  };
}

function buildStockCount({
  conteo_fisico_id = 101,
  fecha_conteo = "2026-06-20",
  location = buildLocation(),
  performed_by = buildUser(),
  details = [],
  observaciones = null,
} = {}) {
  return {
    conteo_fisico_id,
    fecha_conteo,
    location,
    performed_by,
    details,
    observaciones,
  };
}

function buildStockCountDetail({
  conteo_detalle_id = 1001,
  item = buildItem(),
  cantidad_contada = 10,
  existence = null,
  observaciones = null,
} = {}) {
  return {
    conteo_detalle_id,
    item,
    cantidad_contada,
    existence,
    observaciones,
  };
}

function buildAdjustment({
  ajuste_inventario_id = 201,
  fecha_ajuste = "2026-06-21",
  estado = "APLICADO",
  motivo = "Ajuste",
  observaciones = null,
  location = buildLocation(),
  performed_by = buildUser(),
  stock_count = null,
  inventory_adjustment_detail = [],
} = {}) {
  return {
    ajuste_inventario_id,
    fecha_ajuste,
    estado,
    motivo,
    observaciones,
    location,
    performed_by,
    stock_count,
    inventory_adjustment_detail,
  };
}

function buildAdjustmentDetail({
  ajuste_detalle_id = 3001,
  item = buildItem(),
  existence = null,
  cantidad_antes = 8,
  cantidad_contada = 10,
  diferencia = 2,
  tipo_ajuste = "POSITIVO",
} = {}) {
  return {
    ajuste_detalle_id,
    item,
    existence,
    cantidad_antes,
    cantidad_contada,
    diferencia,
    tipo_ajuste,
  };
}

test("classifyPhysicalCountDifference soporta decimales y numeric string", () => {
  assert.deepEqual(
    classifyPhysicalCountDifference({
      expectedQuantity: "4.5",
      countedQuantity: "6",
    }),
    {
      expected: 4.5,
      counted: 6,
      difference: 1.5,
      classification: "SOBRANTE",
    },
  );

  assert.throws(
    () =>
      classifyPhysicalCountDifference({
        expectedQuantity: Number.NaN,
        countedQuantity: 1,
      }),
    /cantidad_teorica debe ser un numero finito/i,
  );
});

test("resolveAdjustmentImpact no aplica el signo dos veces", () => {
  assert.deepEqual(
    resolveAdjustmentImpact({
      cantidad_antes: 12,
      cantidad_contada: 7,
      diferencia: -5,
      tipo_ajuste: "NEGATIVO",
    }),
    {
      impact: "DISMINUCION",
      quantity: 5,
      previousQuantity: 12,
      nextQuantity: 7,
      appliedDifference: -5,
      countedQuantity: 7,
      adjustmentType: "NEGATIVO",
      derivedDifference: -5,
    },
  );
});

test("preview separa conteos y ajustes, mantiene resumen global y evita triple conteo", async () => {
  const itemKg = buildItem();
  const independentItem = buildItem({
    item_id: 11,
    nombre: "Vacuna",
    categoria_item_id: 4,
    nombre_categoria: "Medicamentos",
    unidad_medida_id: 3,
    unidad_nombre: "unidad",
  });

  const stockCounts = [
    buildStockCount({
      conteo_fisico_id: 101,
      details: [
        buildStockCountDetail({
          conteo_detalle_id: 1,
          item: itemKg,
          cantidad_contada: 10,
          existence: { existencia_id: 99, cantidad_actual: 10 },
        }),
      ],
    }),
    buildStockCount({
      conteo_fisico_id: 102,
      details: [
        buildStockCountDetail({
          conteo_detalle_id: 2,
          item: independentItem,
          cantidad_contada: 3,
          existence: { existencia_id: 100, cantidad_actual: 3 },
        }),
      ],
    }),
  ];

  const adjustments = [
    buildAdjustment({
      ajuste_inventario_id: 201,
      stock_count: { conteo_fisico_id: 101, fecha_conteo: "2026-06-20" },
      inventory_adjustment_detail: [
        buildAdjustmentDetail({
          ajuste_detalle_id: 51,
          item: itemKg,
          existence: { existencia_id: 99 },
          cantidad_antes: 8,
          cantidad_contada: 10,
          diferencia: 2,
          tipo_ajuste: "POSITIVO",
        }),
      ],
    }),
    buildAdjustment({
      ajuste_inventario_id: 202,
      stock_count: null,
      inventory_adjustment_detail: [
        buildAdjustmentDetail({
          ajuste_detalle_id: 52,
          item: independentItem,
          cantidad_antes: 6,
          cantidad_contada: 4,
          diferencia: -2,
          tipo_ajuste: "NEGATIVO",
        }),
      ],
    }),
  ];

  const [report, error] = await getInventoryCountsAdjustmentsReportPreviewService(
    {
      page: 1,
      limit: 1,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    {
      user: buildUser(),
    },
    {
      manager: {},
      scope: { mode: "global", userLocationId: null },
      now: new Date("2026-06-23T12:00:00.000Z"),
      stockCountsLoader: async () => stockCounts,
      adjustmentsLoader: async () => adjustments,
      adjustmentMovementLoader: async () => [
        { movimiento_id: 701, referencia_id: 201 },
        { movimiento_id: 702, referencia_id: 202 },
      ],
    },
  );

  assert.equal(error, null);
  assert.equal(report.report_type, "INVENTORY_COUNTS_ADJUSTMENTS");
  assert.equal(report.summary.conteos.total, 2);
  assert.equal(report.summary.conteos.items_con_diferencia, 1);
  assert.equal(report.summary.ajustes.total, 2);
  assert.equal(report.summary.ajustes.vinculados_a_conteo, 1);
  assert.equal(report.summary.ajustes.independientes, 1);
  assert.equal(report.counts.rows.length, 1);
  assert.equal(report.adjustments.rows.length, 1);
  assert.equal(report.counts.pagination.total, 2);
  assert.equal(report.adjustments.pagination.total, 2);
  assert.equal(report.counts.rows[0].count_id, 101);
  assert.equal(report.counts.rows[0].detalles[0].diferencia, 2);
  assert.equal(report.counts.rows[0].detalles[0].clasificacion, "SOBRANTE");
  assert.equal(report.adjustments.rows[0].movement_ids.length, 1);
});

test("preview respeta filtros por clasificacion, ajuste y pagina sin alterar resumen", async () => {
  const item = buildItem();
  const stockCounts = [
    buildStockCount({
      conteo_fisico_id: 201,
      details: [
        buildStockCountDetail({
          conteo_detalle_id: 11,
          item,
          cantidad_contada: 4,
          existence: { existencia_id: 91, cantidad_actual: 6 },
        }),
      ],
    }),
    buildStockCount({
      conteo_fisico_id: 202,
      details: [
        buildStockCountDetail({
          conteo_detalle_id: 12,
          item,
          cantidad_contada: 9,
          existence: { existencia_id: 92, cantidad_actual: 9 },
        }),
      ],
    }),
  ];

  const [report] = await getInventoryCountsAdjustmentsReportPreviewService(
    {
      page: 1,
      limit: 10,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
      con_diferencias: true,
      clasificacion_diferencia: "FALTANTE",
      con_ajuste: false,
    },
    {
      user: buildUser(),
    },
    {
      manager: {},
      scope: { mode: "location", userLocationId: 7 },
      stockCountsLoader: async () => stockCounts,
      adjustmentsLoader: async () => [],
      adjustmentMovementLoader: async () => [],
    },
  );

  assert.equal(report.summary.conteos.total, 1);
  assert.equal(report.summary.conteos.faltantes, 1);
  assert.equal(report.summary.ajustes.total, 0);
  assert.equal(report.counts.rows.length, 1);
  assert.equal(report.counts.rows[0].count_id, 201);
  assert.equal(report.counts.rows[0].detalles[0].clasificacion, "FALTANTE");
});

test("preview calcula resumen con todos los detalles aunque la fila visible se trunque", async () => {
  const details = Array.from({ length: 25 }, (_, index) =>
    buildStockCountDetail({
      conteo_detalle_id: index + 1,
      item: buildItem({
        item_id: index + 1,
        nombre: `Item ${index + 1}`,
      }),
      cantidad_contada: 10,
      existence: {
        existencia_id: index + 100,
        cantidad_actual: 8,
      },
    }));

  const [report, error] = await getInventoryCountsAdjustmentsReportPreviewService(
    {
      page: 1,
      limit: 10,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    { user: buildUser() },
    {
      manager: {},
      scope: { mode: "global", userLocationId: null },
      stockCountsLoader: async () => [buildStockCount({ details })],
      adjustmentsLoader: async () => [],
      adjustmentMovementLoader: async () => [],
    },
  );

  assert.equal(error, null);
  assert.equal(report.counts.rows[0].detalles.length, 20);
  assert.equal(report.counts.rows[0].details_total, 25);
  assert.equal(report.summary.conteos.items_contados, 25);
  assert.equal(report.summary.conteos.items_con_diferencia, 25);
  assert.equal(report.summary.conteos.calidad_datos.derivados_actuales, 25);
  assert.equal(report.summary.conteos.diferencias_por_unidad[0].total, 50);
});

test("preview clasifica calidad de datos historica, derivada y no resoluble", async () => {
  const item = buildItem();
  const stockCounts = [
    buildStockCount({
      details: [
        buildStockCountDetail({
          conteo_detalle_id: 1,
          item,
          cantidad_contada: 7,
          existence: { existencia_id: 100, cantidad_actual: 5 },
        }),
        buildStockCountDetail({
          conteo_detalle_id: 2,
          item: buildItem({ item_id: 11, nombre: "Derivado" }),
          cantidad_contada: 4,
          existence: { existencia_id: 101, cantidad_actual: 3 },
        }),
        buildStockCountDetail({
          conteo_detalle_id: 3,
          item: buildItem({ item_id: 12, nombre: "No resoluble" }),
          cantidad_contada: 2,
          existence: null,
        }),
      ],
    }),
  ];

  const adjustments = [
    buildAdjustment({
      stock_count: { conteo_fisico_id: 101, fecha_conteo: "2026-06-20" },
      inventory_adjustment_detail: [
        buildAdjustmentDetail({
          ajuste_detalle_id: 51,
          item,
          existence: { existencia_id: 100 },
          cantidad_antes: 5,
          cantidad_contada: 7,
          diferencia: 2,
          tipo_ajuste: "POSITIVO",
        }),
      ],
    }),
  ];

  const [report, error] = await getInventoryCountsAdjustmentsReportPreviewService(
    {
      page: 1,
      limit: 10,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    { user: buildUser() },
    {
      manager: {},
      scope: { mode: "global", userLocationId: null },
      stockCountsLoader: async () => stockCounts,
      adjustmentsLoader: async () => adjustments,
      adjustmentMovementLoader: async () => [],
    },
  );

  assert.equal(error, null);
  assert.deepEqual(PHYSICAL_COUNT_DATA_QUALITY, [
    "HISTORICO_CONFIRMADO",
    "DERIVADO_DESDE_EXISTENCIA_ACTUAL",
    "NO_RESOLUBLE",
  ]);
  assert.deepEqual(
    report.counts.rows[0].detalles.map((detail) => detail.data_quality),
    [
      "HISTORICO_CONFIRMADO",
      "DERIVADO_DESDE_EXISTENCIA_ACTUAL",
      "NO_RESOLUBLE",
    ],
  );
  assert.equal(report.counts.rows[0].detalles[2].clasificacion, null);
  assert.equal(report.summary.conteos.calidad_datos.historicos_confirmados, 1);
  assert.equal(report.summary.conteos.calidad_datos.derivados_actuales, 1);
  assert.equal(report.summary.conteos.calidad_datos.no_resolubles, 1);
  assert.equal(report.summary.conteos.sobrantes, 2);
  assert.equal(report.summary.conteos.faltantes, 0);
  assert.ok(
    report.warning_details.some(
      (warning) => warning.code === "COUNT_DETAIL_UNRESOLVABLE_HISTORICAL_BASELINE",
    ),
  );
});

test("getInventoryCountsAdjustmentsReportExportService conserva resumen y entrega detalles completos", async () => {
  const details = Array.from({ length: 25 }, (_, index) =>
    buildStockCountDetail({
      conteo_detalle_id: index + 1,
      item: buildItem({ item_id: index + 1, nombre: `Item ${index + 1}` }),
      cantidad_contada: 5,
      existence: { existencia_id: index + 100, cantidad_actual: 4 },
    }));

  const deps = {
    manager: {},
    scope: { mode: "global", userLocationId: null },
    stockCountsLoader: async () => [buildStockCount({ details })],
    adjustmentsLoader: async () => [],
    adjustmentMovementLoader: async () => [],
  };

  const [preview] = await getInventoryCountsAdjustmentsReportPreviewService(
    {
      page: 1,
      limit: 1,
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    { user: buildUser() },
    deps,
  );
  const [report, error] = await getInventoryCountsAdjustmentsReportExportService(
    {
      format: "xlsx",
      fecha_desde: "2026-06-01",
      fecha_hasta: "2026-06-30",
    },
    { user: buildUser() },
    deps,
  );

  assert.equal(error, null);
  assert.deepEqual(report.summary, preview.summary);
  assert.equal(preview.counts.rows[0].detalles.length, 20);
  assert.equal(report.counts[0].detalles.length, 25);
});

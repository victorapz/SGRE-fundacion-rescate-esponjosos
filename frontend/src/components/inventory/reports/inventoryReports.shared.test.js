import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_REPORT_VIEW_IDS,
  buildAllowedInventoryReportViews,
  buildDefaultCountsAdjustmentsReportFilters,
  buildDefaultExistencesReportFilters,
  formatInventoryReportLabel,
  formatInventoryReportQuantity,
  normalizeCountsAdjustmentsReportFilters,
  normalizeExistencesReportFilters,
  resolveActiveInventoryReportView,
  validateCountsAdjustmentsReportFilters,
  validateExistencesReportFilters,
} from "./inventoryReports.shared.js";

test("buildDefaultExistencesReportFilters expone el snapshot esperado", () => {
  assert.deepEqual(buildDefaultExistencesReportFilters(), {
    categoria_id: "",
    ubicacion_id: "",
    item_id: "",
    unidad_id: "",
    estado_stock: "",
    solo_sin_stock: false,
    solo_bajo_minimo: false,
    activo: "",
    search: "",
  });
});

test("buildDefaultCountsAdjustmentsReportFilters expone el snapshot esperado", () => {
  assert.deepEqual(buildDefaultCountsAdjustmentsReportFilters(), {
    fecha_desde: "",
    fecha_hasta: "",
    ubicacion_id: "",
    item_id: "",
    categoria_id: "",
    responsable_id: "",
    estado_ajuste: "",
    con_diferencias: "",
    clasificacion_diferencia: "",
    con_ajuste: "",
    ajuste_tipo: "",
    search: "",
  });
});

test("validateExistencesReportFilters bloquea filtros contradictorios", () => {
  assert.match(
    validateExistencesReportFilters({
      solo_sin_stock: true,
      solo_bajo_minimo: true,
    }),
    /solo sin stock/i,
  );
});

test("validateCountsAdjustmentsReportFilters válida rango de fechas y conflictos", () => {
  assert.match(
    validateCountsAdjustmentsReportFilters({
      fecha_desde: "2026-06-30",
      fecha_hasta: "2026-06-01",
    }),
    /fecha desde/i,
  );

  assert.match(
    validateCountsAdjustmentsReportFilters({
      con_diferencias: false,
      clasificacion_diferencia: "FALTANTE",
    }),
    /sin diferencias/i,
  );
});

test("normalize filtros conserva ids y transforma booleanos", () => {
  assert.deepEqual(
    normalizeExistencesReportFilters({
      categoria_id: "5",
      activo: "true",
      search: "  alimento  ",
    }),
    {
      categoria_id: "5",
      ubicacion_id: "",
      item_id: "",
      unidad_id: "",
      estado_stock: "",
      solo_sin_stock: false,
      solo_bajo_minimo: false,
      activo: true,
      search: "alimento",
    },
  );

  assert.deepEqual(
    normalizeCountsAdjustmentsReportFilters({
      responsable_id: "8",
      con_ajuste: "false",
      clasificacion_diferencia: "sobrante",
    }),
    {
      fecha_desde: "",
      fecha_hasta: "",
      ubicacion_id: "",
      item_id: "",
      categoria_id: "",
      responsable_id: "8",
      estado_ajuste: "",
      con_diferencias: null,
      clasificacion_diferencia: "SOBRANTE",
      con_ajuste: false,
      ajuste_tipo: "",
      search: "",
    },
  );
});

test("formatInventoryReportLabel y quantity devuelven presentacion legible", () => {
  assert.equal(formatInventoryReportLabel("BAJO_MINIMO"), "Bajo mínimo");
  assert.equal(formatInventoryReportLabel("NO_RESOLUBLE"), "No resoluble");
  assert.equal(formatInventoryReportQuantity(2.5, "kg"), "2,5 kg");
  assert.equal(formatInventoryReportQuantity(10, "unidades"), "10 unidades");
});

test("allowed inventory report views y active view respetan permisos", () => {
  const allowedViews = buildAllowedInventoryReportViews({
    canReadExistences: true,
    canReadCountsAdjustments: false,
  });

  assert.deepEqual(allowedViews, [
    {
      id: INVENTORY_REPORT_VIEW_IDS.EXISTENCES,
      label: "Existencias actuales",
      visible: true,
    },
  ]);
  assert.equal(resolveActiveInventoryReportView("counts-adjustments", allowedViews), "existences");
});

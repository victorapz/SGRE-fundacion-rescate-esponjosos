"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  inventoryCountsAdjustmentsReportExportValidation,
  inventoryCountsAdjustmentsReportPreviewValidation,
} from "../validations/inventory_counts_adjustments_report.validation.js";

test("valida query minima del informe de conteos y ajustes", () => {
  const { error, value } = inventoryCountsAdjustmentsReportPreviewValidation.validate({
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-30",
    con_diferencias: true,
    clasificacion_diferencia: "FALTANTE",
  });

  assert.equal(error, undefined);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 50);
});

test("rechaza parametros desconocidos", () => {
  const { error } = inventoryCountsAdjustmentsReportPreviewValidation.validate({
    foo: "bar",
  });

  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("rechaza fecha invertida", () => {
  const { error } = inventoryCountsAdjustmentsReportPreviewValidation.validate({
    fecha_desde: "2026-06-30",
    fecha_hasta: "2026-06-01",
  });

  assert.match(error.message, /fecha_desde no puede ser mayor que fecha_hasta/i);
});

test("rechaza clasificacion sin diferencia compatible", () => {
  const { error } = inventoryCountsAdjustmentsReportPreviewValidation.validate({
    con_diferencias: false,
    clasificacion_diferencia: "FALTANTE",
  });

  assert.match(error.message, /con_diferencias=false entra en conflicto/i);
});

test("rechaza SIN_DIFERENCIA con ajuste_tipo", () => {
  const { error } = inventoryCountsAdjustmentsReportPreviewValidation.validate({
    clasificacion_diferencia: "SIN_DIFERENCIA",
    ajuste_tipo: "POSITIVO",
  });

  assert.match(error.message, /SIN_DIFERENCIA entra en conflicto con ajuste_tipo/i);
});

test("export requiere format y rechaza limit", () => {
  const missingFormat = inventoryCountsAdjustmentsReportExportValidation.validate({});
  const withLimit = inventoryCountsAdjustmentsReportExportValidation.validate({
    format: "xlsx",
    limit: 50,
  });

  assert.match(missingFormat.error.message, /format es obligatorio/i);
  assert.match(withLimit.error.message, /limit no se permite en exportacion|is not allowed/i);
});

"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  inventoryExistenceReportExportValidation,
  inventoryExistenceReportPreviewValidation,
} from "../validations/inventory_existence_report.validation.js";

test("inventoryExistenceReportPreviewValidation aplica defaults con query vacia", () => {
  const { error, value } = inventoryExistenceReportPreviewValidation.validate({});

  assert.equal(error, undefined);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 50);
});

test("inventoryExistenceReportPreviewValidation acepta filtros validos", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    categoria_id: 3,
    ubicacion_id: 4,
    item_id: 5,
    unidad_id: 2,
    estado_stock: "BAJO_MINIMO",
    activo: true,
    search: "bodega",
  });

  assert.equal(error, undefined);
});

test("inventoryExistenceReportPreviewValidation rechaza ids invalidos", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    ubicacion_id: -1,
  });

  assert.match(error.message, /numero positivo/i);
});

test("inventoryExistenceReportPreviewValidation rechaza estado invalido", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    estado_stock: "AGOTADO",
  });

  assert.match(error.message, /estado_stock del informe/i);
});

test("inventoryExistenceReportPreviewValidation rechaza filtros contradictorios", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    solo_sin_stock: true,
    solo_bajo_minimo: true,
  });

  assert.match(error.message, /no pueden ser true/i);
});

test("inventoryExistenceReportPreviewValidation rechaza conflicto con estado_stock", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    estado_stock: "DISPONIBLE",
    solo_sin_stock: true,
  });

  assert.match(error.message, /conflicto/i);
});

test("inventoryExistenceReportPreviewValidation rechaza search demasiado largo", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    search: "a".repeat(256),
  });

  assert.match(error.message, /255 caracteres/i);
});

test("inventoryExistenceReportPreviewValidation rechaza campos desconocidos", () => {
  const { error } = inventoryExistenceReportPreviewValidation.validate({
    bogus: "x",
  });

  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("inventoryExistenceReportExportValidation requiere format y rechaza page", () => {
  const missingFormat = inventoryExistenceReportExportValidation.validate({});
  const withPage = inventoryExistenceReportExportValidation.validate({
    format: "pdf",
    page: 2,
  });

  assert.match(missingFormat.error.message, /format es obligatorio/i);
  assert.match(withPage.error.message, /page no se permite en exportacion|is not allowed/i);
});

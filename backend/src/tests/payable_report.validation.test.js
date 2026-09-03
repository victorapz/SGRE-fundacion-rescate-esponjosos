"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  payableReportExportValidation,
  payableReportPreviewValidation,
} from "../validations/payable_report.validation.js";

test("payableReportPreviewValidation aplica defaults con query vacia", () => {
  const { error, value } = payableReportPreviewValidation.validate({});

  assert.equal(error, undefined);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 50);
});

test("payableReportPreviewValidation acepta rangos y filtros validos", () => {
  const { error } = payableReportPreviewValidation.validate({
    fecha_emision_desde: "2026-06-01",
    fecha_emision_hasta: "2026-06-23",
    vencimiento_desde: "2026-06-10",
    vencimiento_hasta: "2026-06-30",
    estado: "PAGADA_PARCIAL",
    proveedor_id: 5,
    clinica_id: 7,
    categoria_id: 3,
    origen_tipo: "PURCHASE",
    moneda: "CLP",
    solo_vencidas: true,
    con_saldo: false,
    search: "proveedor",
  });

  assert.equal(error, undefined);
});

test("payableReportPreviewValidation rechaza rango de emision invertido", () => {
  const { error } = payableReportPreviewValidation.validate({
    fecha_emision_desde: "2026-06-23",
    fecha_emision_hasta: "2026-06-01",
  });

  assert.match(error.message, /fecha_emision_desde no puede ser mayor/i);
});

test("payableReportPreviewValidation rechaza rango de vencimiento mayor a 366 dias", () => {
  const { error } = payableReportPreviewValidation.validate({
    vencimiento_desde: "2025-01-01",
    vencimiento_hasta: "2026-06-23",
  });

  assert.match(error.message, /no puede superar 366 dias/i);
});

test("payableReportPreviewValidation rechaza estado invalido", () => {
  const { error } = payableReportPreviewValidation.validate({
    estado: "CONFIRMADA",
  });

  assert.match(error.message, /estado del informe/i);
});

test("payableReportPreviewValidation rechaza ids invalidos", () => {
  const { error } = payableReportPreviewValidation.validate({
    proveedor_id: -1,
  });

  assert.match(error.message, /numero positivo/i);
});

test("payableReportPreviewValidation rechaza moneda invalida", () => {
  const { error } = payableReportPreviewValidation.validate({
    moneda: "ARS",
  });

  assert.match(error.message, /moneda del informe/i);
});

test("payableReportPreviewValidation rechaza search demasiado largo", () => {
  const { error } = payableReportPreviewValidation.validate({
    search: "a".repeat(256),
  });

  assert.match(error.message, /255 caracteres/i);
});

test("payableReportPreviewValidation rechaza campos desconocidos", () => {
  const { error } = payableReportPreviewValidation.validate({
    bogus: "x",
  });

  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("payableReportExportValidation requiere format y rechaza limit", () => {
  const missingFormat = payableReportExportValidation.validate({});
  const withLimit = payableReportExportValidation.validate({
    format: "xlsx",
    limit: 10,
  });

  assert.match(missingFormat.error.message, /format es obligatorio/i);
  assert.match(withLimit.error.message, /limit no se permite en exportacion|is not allowed/i);
});

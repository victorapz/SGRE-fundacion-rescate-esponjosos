"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  reportCurrencySchema,
  reportDateRangeSchema,
  reportDateSchema,
  reportExportQueryValidation,
  reportFormatSchema,
  reportIdSchema,
  reportPaginationSchema,
  reportPreviewQueryValidation,
} from "../validations/report.validation.js";

test("reportDateSchema acepta una fecha valida", () => {
  const { error, value } = reportDateSchema.validate("2026-06-23");

  assert.equal(error, undefined);
  assert.equal(value, "2026-06-23");
});

test("reportDateSchema rechaza una fecha imposible", () => {
  const { error } = reportDateSchema.validate("2026-02-30");

  assert.match(error.message, /no es valida/i);
});

test("reportDateRangeSchema rechaza un rango invertido", () => {
  const { error } = reportDateRangeSchema.validate({
    fecha_desde: "2026-06-24",
    fecha_hasta: "2026-06-23",
  });

  assert.match(error.message, /no puede ser mayor/i);
});

test("reportDateRangeSchema rechaza un rango demasiado grande", () => {
  const { error } = reportDateRangeSchema.validate({
    fecha_desde: "2025-01-01",
    fecha_hasta: "2026-06-23",
  });

  assert.match(error.message, /no puede superar 366 dias/i);
});

test("reportPaginationSchema aplica defaults", () => {
  const { error, value } = reportPaginationSchema.validate({});

  assert.equal(error, undefined);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 50);
});

test("reportPaginationSchema rechaza limit invalido", () => {
  const { error } = reportPaginationSchema.validate({ limit: 999 });

  assert.match(error.message, /no puede superar 200/i);
});

test("reportCurrencySchema acepta CLP USD y EUR", () => {
  assert.equal(reportCurrencySchema.validate("clp").error, undefined);
  assert.equal(reportCurrencySchema.validate("USD").error, undefined);
  assert.equal(reportCurrencySchema.validate("EUR").error, undefined);
});

test("reportCurrencySchema rechaza moneda invalida", () => {
  const { error } = reportCurrencySchema.validate("ARS");

  assert.match(error.message, /debe ser una de/i);
});

test("reportFormatSchema solo acepta pdf y xlsx", () => {
  assert.equal(reportFormatSchema.validate("pdf").error, undefined);
  assert.equal(reportFormatSchema.validate("xlsx").error, undefined);
  assert.match(reportFormatSchema.validate("csv").error.message, /debe ser uno de/i);
});

test("reportIdSchema exige enteros positivos", () => {
  assert.equal(reportIdSchema("report_id").validate(15).error, undefined);
  assert.match(reportIdSchema("report_id").validate(-1).error.message, /positivo/i);
});

test("reportPreviewQueryValidation acepta una query valida", () => {
  const { error } = reportPreviewQueryValidation.validate({
    page: 2,
    limit: 25,
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-23",
    moneda: "CLP",
    search: "compra proveedor",
  });

  assert.equal(error, undefined);
});

test("reportPreviewQueryValidation rechaza parametros desconocidos", () => {
  const { error } = reportPreviewQueryValidation.validate({
    page: 1,
    bogus: "x",
  });

  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("reportExportQueryValidation exige format", () => {
  const { error } = reportExportQueryValidation.validate({
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-23",
  });

  assert.match(error.message, /format es obligatorio/i);
});

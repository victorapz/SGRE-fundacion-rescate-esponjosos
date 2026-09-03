"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  accountingTransactionsReportExportValidation,
  accountingTransactionsReportPreviewValidation,
} from "../validations/accounting_report.validation.js";

test("accountingTransactionsReportPreviewValidation aplica defaults con query vacia", () => {
  const { error, value } = accountingTransactionsReportPreviewValidation.validate({});

  assert.equal(error, undefined);
  assert.equal(value.page, 1);
  assert.equal(value.limit, 50);
});

test("accountingTransactionsReportPreviewValidation acepta un rango valido", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-23",
    tipo: "INGRESO",
    estado: "CONFIRMADA",
    moneda: "CLP",
    categoria_id: 2,
    proveedor_pago_id: 3,
    search: "paypal",
    origin: "PAYPAL_DONATION_CAPTURE",
  });

  assert.equal(error, undefined);
});

test("accountingTransactionsReportPreviewValidation rechaza rango invertido", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    fecha_desde: "2026-06-23",
    fecha_hasta: "2026-06-01",
  });

  assert.match(error.message, /no puede ser mayor/i);
});

test("accountingTransactionsReportPreviewValidation rechaza rango mayor a 366 dias", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    fecha_desde: "2025-01-01",
    fecha_hasta: "2026-06-23",
  });

  assert.match(error.message, /no puede superar 366 dias/i);
});

test("accountingTransactionsReportPreviewValidation rechaza tipo invalido", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    tipo: "SALDO",
  });

  assert.match(error.message, /tipo del informe/i);
});

test("accountingTransactionsReportPreviewValidation rechaza estado invalido", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    estado: "PAGADA",
  });

  assert.match(error.message, /estado del informe/i);
});

test("accountingTransactionsReportPreviewValidation rechaza moneda invalida", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    moneda: "ARS",
  });

  assert.match(error.message, /moneda del informe/i);
});

test("accountingTransactionsReportPreviewValidation rechaza ids invalidos", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    categoria_id: -2,
  });

  assert.match(error.message, /numero positivo/i);
});

test("accountingTransactionsReportPreviewValidation rechaza search demasiado largo", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    search: "a".repeat(256),
  });

  assert.match(error.message, /255 caracteres/i);
});

test("accountingTransactionsReportPreviewValidation rechaza campos desconocidos", () => {
  const { error } = accountingTransactionsReportPreviewValidation.validate({
    bogus: "x",
  });

  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("accountingTransactionsReportExportValidation requiere format y rechaza page", () => {
  const missingFormat = accountingTransactionsReportExportValidation.validate({});
  const withPage = accountingTransactionsReportExportValidation.validate({
    format: "pdf",
    page: 1,
  });

  assert.match(missingFormat.error.message, /format es obligatorio/i);
  assert.match(withPage.error.message, /page no se permite en exportacion|is not allowed/i);
});

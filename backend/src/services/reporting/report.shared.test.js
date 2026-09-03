"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_FIELD_TYPES,
  REPORT_PREVIEW_DEFAULT_LIMIT,
  REPORT_PREVIEW_MAX_LIMIT,
  REPORT_TIME_ZONE,
} from "./report.constants.js";
import {
  accumulateCurrencyTotals,
  buildChileReportDateRange,
  buildReportPaginationMeta,
  buildReportPreviewResponse,
  getCurrentChileDateTime,
  normalizeReportCurrency,
  normalizeReportPagination,
  parseReportDate,
  sanitizeSpreadsheetText,
  toReportNumber,
} from "./report.shared.js";

function formatChileDateTime(date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

test("parseReportDate acepta una fecha ISO valida", () => {
  const parsed = parseReportDate("2026-06-23");

  assert.equal(parsed.isoDate, "2026-06-23");
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.month, 6);
  assert.equal(parsed.day, 23);
});

test("parseReportDate rechaza una fecha imposible", () => {
  assert.throws(
    () => parseReportDate("2026-02-30"),
    /no es valida/i,
  );
});

test("parseReportDate acepta un bisiesto real", () => {
  const parsed = parseReportDate("2028-02-29");
  assert.equal(parsed.isoDate, "2028-02-29");
});

test("buildChileReportDateRange rechaza un rango invertido", () => {
  assert.throws(
    () => buildChileReportDateRange({
      fecha_desde: "2026-06-24",
      fecha_hasta: "2026-06-23",
    }),
    /fecha_desde no puede ser mayor/i,
  );
});

test("buildChileReportDateRange rechaza un rango mayor al maximo permitido", () => {
  assert.throws(
    () => buildChileReportDateRange({
      fecha_desde: "2025-01-01",
      fecha_hasta: "2026-06-23",
    }),
    /no puede superar 366 dias/i,
  );
});

test("buildChileReportDateRange aplica default de ultimos 30 dias", () => {
  const range = buildChileReportDateRange({
    fieldType: REPORT_FIELD_TYPES.DATE,
    now: new Date("2026-06-23T18:45:00.000Z"),
  });

  assert.equal(range.normalized.fecha_hasta, "2026-06-23");
  assert.equal(range.normalized.fecha_desde, "2026-05-25");
  assert.equal(range.dayCount, 30);
});

test("buildChileReportDateRange usa inicio inclusivo y fin exclusivo para timestamp", () => {
  const range = buildChileReportDateRange({
    fecha_desde: "2026-06-23",
    fecha_hasta: "2026-06-23",
    fieldType: REPORT_FIELD_TYPES.TIMESTAMP,
  });

  assert.equal(formatChileDateTime(range.fromInclusive), "2026-06-23 00:00:00");
  assert.equal(formatChileDateTime(range.toExclusive), "2026-06-24 00:00:00");
});

test("buildChileReportDateRange mantiene date sin conversion indebida", () => {
  const range = buildChileReportDateRange({
    fecha_desde: "2026-06-01",
    fecha_hasta: "2026-06-30",
    fieldType: REPORT_FIELD_TYPES.DATE,
  });

  assert.equal(range.fromInclusive, "2026-06-01");
  assert.equal(range.toInclusive, "2026-06-30");
  assert.equal(range.toExclusive, "2026-07-01");
});

test("buildChileReportDateRange resuelve correctamente fechas cercanas a cambios DST de Chile", () => {
  const autumnRange = buildChileReportDateRange({
    fecha_desde: "2026-04-04",
    fecha_hasta: "2026-04-04",
    fieldType: REPORT_FIELD_TYPES.TIMESTAMP,
  });
  const springRange = buildChileReportDateRange({
    fecha_desde: "2026-09-06",
    fecha_hasta: "2026-09-06",
    fieldType: REPORT_FIELD_TYPES.TIMESTAMP,
  });

  assert.equal(formatChileDateTime(autumnRange.fromInclusive), "2026-04-04 00:00:00");
  assert.equal(formatChileDateTime(autumnRange.toExclusive), "2026-04-05 00:00:00");
  // Cuando Chile adelanta la hora, el primer instante valido del dia local
  // puede comenzar a la 01:00 en vez de las 00:00.
  assert.equal(formatChileDateTime(springRange.fromInclusive), "2026-09-06 01:00:00");
  assert.equal(formatChileDateTime(springRange.toExclusive), "2026-09-07 00:00:00");
  assert.equal(springRange.localBounds.fromInclusive, "2026-09-06");
  assert.equal(springRange.localBounds.toExclusive, "2026-09-07");
});

test("normalizeReportPagination aplica defaults y calcula skip", () => {
  const pagination = normalizeReportPagination({});

  assert.equal(pagination.page, 1);
  assert.equal(pagination.limit, REPORT_PREVIEW_DEFAULT_LIMIT);
  assert.equal(pagination.skip, 0);
});

test("normalizeReportPagination respeta el maximo permitido", () => {
  const pagination = normalizeReportPagination({ page: 3, limit: 999 });

  assert.equal(pagination.page, 3);
  assert.equal(pagination.limit, REPORT_PREVIEW_MAX_LIMIT);
  assert.equal(pagination.skip, (3 - 1) * REPORT_PREVIEW_MAX_LIMIT);
});

test("buildReportPaginationMeta calcula total_pages y navegacion", () => {
  const meta = buildReportPaginationMeta({
    page: 2,
    limit: 50,
    total: 120,
  });

  assert.deepEqual(meta, {
    page: 2,
    limit: 50,
    total: 120,
    total_pages: 3,
    has_previous: true,
    has_next: true,
  });
});

test("normalizeReportCurrency acepta CLP USD y EUR", () => {
  assert.equal(normalizeReportCurrency("clp"), "CLP");
  assert.equal(normalizeReportCurrency("USD"), "USD");
  assert.equal(normalizeReportCurrency(" eur "), "EUR");
});

test("normalizeReportCurrency rechaza monedas invalidas", () => {
  assert.throws(
    () => normalizeReportCurrency("ARS"),
    /debe ser una de/i,
  );
});

test("accumulateCurrencyTotals agrupa montos separados por moneda", () => {
  const summary = {};

  accumulateCurrencyTotals(summary, "CLP", {
    ingresos: "1000.50",
    egresos: 0,
  });
  accumulateCurrencyTotals(summary, "CLP", {
    ingresos: 99.5,
    neto: "1100",
  });
  accumulateCurrencyTotals(summary, "USD", {
    ingresos: 20,
    neto: 20,
  });

  assert.deepEqual(summary, {
    CLP: {
      moneda: "CLP",
      ingresos: 1100,
      egresos: 0,
      neto: 1100,
    },
    USD: {
      moneda: "USD",
      ingresos: 20,
      neto: 20,
    },
  });
});

test("toReportNumber rechaza NaN e Infinity", () => {
  assert.throws(() => toReportNumber(Number.NaN), /numero finito/i);
  assert.throws(() => toReportNumber(Number.POSITIVE_INFINITY), /numero finito/i);
});

test("buildReportPreviewResponse devuelve shape comun y usuario minimo", () => {
  const response = buildReportPreviewResponse({
    reportType: "ACCOUNTING_TRANSACTIONS",
    generatedBy: {
      id_usuario: 7,
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@fundacion.cl",
    },
    filters: { moneda: "CLP" },
    summary: { by_currency: [] },
    rows: [{ id: 1 }],
    pagination: buildReportPaginationMeta({ page: 1, limit: 50, total: 1 }),
    warnings: ["Monedas multiples detectadas", "", null],
  });

  assert.equal(response.report_type, "ACCOUNTING_TRANSACTIONS");
  assert.equal(response.generated_timezone, REPORT_TIME_ZONE);
  assert.deepEqual(response.generated_by, {
    id: 7,
    name: "Ana Perez",
  });
  assert.equal(response.generated_by.email, undefined);
  assert.deepEqual(response.warnings, ["Monedas multiples detectadas"]);
});

test("sanitizeSpreadsheetText neutraliza prefijos peligrosos y preserva texto seguro", () => {
  assert.equal(sanitizeSpreadsheetText("=SUM(A1:A2)"), "'=SUM(A1:A2)");
  assert.equal(sanitizeSpreadsheetText("+cmd"), "'+cmd");
  assert.equal(sanitizeSpreadsheetText("-10+20"), "'-10+20");
  assert.equal(sanitizeSpreadsheetText("@IMPORT"), "'@IMPORT");
  assert.equal(sanitizeSpreadsheetText("texto normal"), "texto normal");
  assert.equal(sanitizeSpreadsheetText("  =formula"), "'  =formula");
  assert.equal(sanitizeSpreadsheetText(42), 42);
  assert.equal(sanitizeSpreadsheetText(null), "");
});

test("getCurrentChileDateTime expone instant e informacion de Chile", () => {
  const current = getCurrentChileDateTime(new Date("2026-06-23T15:30:00.000Z"));

  assert.equal(current.isoInstant, "2026-06-23T15:30:00.000Z");
  assert.equal(current.chileDate, "2026-06-23");
  assert.equal(current.timeZone, REPORT_TIME_ZONE);
});

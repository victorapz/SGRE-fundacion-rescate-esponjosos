import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLatestClosedMonthlyAccountingPeriod,
  buildAllowedAccountingReportViews,
  buildDefaultPayablesReportFilters,
  buildDefaultTransactionsReportFilters,
  buildLast30DayRange,
  formatAccountingPublicReportState,
  formatAccountingReportLabel,
  formatAccountingReportMonthName,
  formatAccountingReportMoney,
  formatAccountingReportPeriod,
  isClosedMonthlyAccountingPeriod,
  normalizeAccountingReportWarnings,
  resolveActiveAccountingReportView,
  validatePayablesReportFilters,
  validateTransactionsReportFilters,
} from "./accountingReports.shared.js";

test("buildLast30DayRange usa una ventana coherente de 30 dias", () => {
  const range = buildLast30DayRange(new Date("2026-06-25T12:00:00"));

  assert.deepEqual(range, {
    fecha_desde: "2026-05-27",
    fecha_hasta: "2026-06-25",
  });
});

test("buildDefaultTransactionsReportFilters inicializa fechas y campos vacios", () => {
  const filters = buildDefaultTransactionsReportFilters(new Date("2026-06-25T12:00:00"));

  assert.equal(filters.fecha_desde, "2026-05-27");
  assert.equal(filters.fecha_hasta, "2026-06-25");
  assert.equal(filters.tipo, "");
  assert.equal(filters.search, "");
});

test("buildDefaultPayablesReportFilters deja checkboxes en null para no filtrar", () => {
  const filters = buildDefaultPayablesReportFilters();

  assert.equal(filters.solo_vencidas, null);
  assert.equal(filters.con_saldo, null);
  assert.equal(filters.search, "");
});

test("validadores bloquean rangos invalidos", () => {
  assert.match(
    validateTransactionsReportFilters({
      fecha_desde: "2026-06-26",
      fecha_hasta: "2026-06-25",
    }),
    /Rango principal/i,
  );

  assert.match(
    validatePayablesReportFilters({
      fecha_emision_desde: "2026-06-26",
      fecha_emision_hasta: "2026-06-25",
    }),
    /Emision/i,
  );
});

test("normalizeAccountingReportWarnings acepta strings y objetos seguros", () => {
  const warnings = normalizeAccountingReportWarnings([
    "Existe una diferencia.",
    { message: "Falta categoria." },
    { code: "SIN_ORIGEN" },
    null,
  ]);

  assert.deepEqual(warnings, [
    "Existe una diferencia.",
    "Falta categoria.",
    "SIN_ORIGEN",
  ]);
});

test("helpers de subtabs resuelven vistas permitidas y activa inicial", () => {
  const views = buildAllowedAccountingReportViews({
    canReadTransactions: true,
    canReadPayables: true,
    canReadPublicReports: true,
  });

  assert.deepEqual(
    views.map((view) => view.id),
    ["transactions", "payables", "public-reports"],
  );
  assert.equal(resolveActiveAccountingReportView("", views), "transactions");
  assert.equal(resolveActiveAccountingReportView("payables", views), "payables");
});

test("formatAccountingReportLabel traduce enums de negocio conocidos", () => {
  assert.equal(formatAccountingReportLabel("PAYPAL_DONATION_CAPTURE"), "Donación de PayPal");
  assert.equal(
    formatAccountingReportLabel("PARCIALMENTE_REEMBOLSADA"),
    "Parcialmente reembolsada",
  );
});

test("formatAccountingReportMoney aplica reglas por moneda", () => {
  assert.equal(formatAccountingReportMoney(9000, "CLP"), "CLP $9.000");
  assert.equal(formatAccountingReportMoney(10000.99, "USD"), "USD $10,000.99");
  assert.equal(formatAccountingReportMoney(0, "USD"), "USD $0.00");
  assert.equal(formatAccountingReportMoney(0, "CLP"), "CLP $0");
});

test("helpers de informes publicos traducen meses, estados y periodos", () => {
  assert.equal(formatAccountingReportMonthName(6), "Junio");
  assert.equal(formatAccountingReportPeriod(2026, 6), "Junio de 2026");
  assert.equal(formatAccountingPublicReportState("PUBLICADO"), "Publicado");
});

test("validación de periodos cerrados bloquea mes actual o futuro", () => {
  const now = new Date("2026-06-25T12:00:00");

  assert.equal(isClosedMonthlyAccountingPeriod(2026, 5, now), true);
  assert.equal(isClosedMonthlyAccountingPeriod(2026, 6, now), false);
  assert.equal(isClosedMonthlyAccountingPeriod(2026, 7, now), false);
  assert.deepEqual(buildLatestClosedMonthlyAccountingPeriod(now), {
    year: 2026,
    month: 5,
  });
});

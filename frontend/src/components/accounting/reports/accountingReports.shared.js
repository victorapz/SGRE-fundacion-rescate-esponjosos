export const ACCOUNTING_REPORT_VIEW_IDS = {
  TRANSACTIONS: "transactions",
  PAYABLES: "payables",
  PUBLIC_REPORTS: "public-reports",
};

export const ACCOUNTING_REPORT_MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const ACCOUNTING_REPORT_TRANSACTION_TYPES = [
  "INGRESO",
  "EGRESO",
  "REEMBOLSO",
  "AJUSTE",
];

export const ACCOUNTING_REPORT_TRANSACTION_STATES = [
  "CONFIRMADA",
  "ANULADA",
  "COMPLETADA",
  "CANCELADA",
  "FALLIDA",
  "PENDIENTE",
];

export const ACCOUNTING_REPORT_PAYABLE_STATES = [
  "PENDIENTE",
  "PAGADA_PARCIAL",
  "PAGADA",
  "VENCIDA",
  "ANULADA",
  "CONDONADA",
];

export const ACCOUNTING_REPORT_CURRENCIES = ["CLP", "USD", "EUR"];

export const ACCOUNTING_PUBLIC_REPORT_STATES = [
  "BORRADOR",
  "PUBLICADO",
  "ARCHIVADO",
];

export const ACCOUNTING_REPORT_TRANSACTION_ORIGINS = [
  "MANUAL",
  "PURCHASE",
  "EXAM",
  "HOSPITALIZATION",
  "PROCEDURE",
  "VET_CHECKUP",
  "PAYPAL_DONATION_CAPTURE",
  "PAYPAL_DONATION_REFUND",
  "PAYPAL_DONATION_REVERSAL",
];

export const ACCOUNTING_REPORT_PAYABLE_ORIGINS = [
  "PURCHASE",
  "EXAM",
  "HOSPITALIZATION",
  "PROCEDURE",
  "VET_CHECKUP",
];

export function buildAllowedAccountingReportViews({
  canReadTransactions = false,
  canReadPayables = false,
  canReadPublicReports = false,
} = {}) {
  return [
    {
      id: ACCOUNTING_REPORT_VIEW_IDS.TRANSACTIONS,
      label: "Movimientos contables",
      allowed: Boolean(canReadTransactions),
    },
    {
      id: ACCOUNTING_REPORT_VIEW_IDS.PAYABLES,
      label: "Cuentas por pagar",
      allowed: Boolean(canReadPayables),
    },
    {
      id: ACCOUNTING_REPORT_VIEW_IDS.PUBLIC_REPORTS,
      label: "Informes publicos",
      allowed: Boolean(canReadPublicReports),
    },
  ].filter((item) => item.allowed);
}

export function resolveActiveAccountingReportView(currentView, allowedViews = []) {
  if (allowedViews.some((item) => item.id === currentView)) {
    return currentView;
  }

  return allowedViews[0]?.id || "";
}

function formatDateParts(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(baseDate, days) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseSafeDate(value, options = {}) {
  const {
    preferNoon = false,
  } = options;

  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Date(`${value}T${preferNoon ? "12:00:00" : "00:00:00"}`);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildLast30DayRange(now = new Date()) {
  const endDate = new Date(now);
  const startDate = addDays(endDate, -29);

  return {
    fecha_desde: formatDateParts(startDate),
    fecha_hasta: formatDateParts(endDate),
  };
}

export function buildDefaultTransactionsReportFilters(now = new Date()) {
  const range = buildLast30DayRange(now);

  return {
    fecha_desde: range.fecha_desde,
    fecha_hasta: range.fecha_hasta,
    tipo: "",
    estado: "",
    categoria_id: "",
    proveedor_pago_id: "",
    moneda: "",
    origin: "",
    search: "",
  };
}

export function buildDefaultPayablesReportFilters() {
  return {
    fecha_emision_desde: "",
    fecha_emision_hasta: "",
    vencimiento_desde: "",
    vencimiento_hasta: "",
    estado: "",
    proveedor_id: "",
    clinica_id: "",
    categoria_id: "",
    origen_tipo: "",
    moneda: "",
    solo_vencidas: null,
    con_saldo: null,
    search: "",
  };
}

function validateDatePair(fromValue, toValue, label) {
  if (fromValue && toValue && String(fromValue) > String(toValue)) {
    return `${label}: la fecha inicial no puede ser posterior a la fecha final.`;
  }

  return "";
}

export function validateTransactionsReportFilters(filters = {}) {
  return validateDatePair(filters.fecha_desde, filters.fecha_hasta, "Rango principal");
}

export function validatePayablesReportFilters(filters = {}) {
  return (
    validateDatePair(
      filters.fecha_emision_desde,
      filters.fecha_emision_hasta,
      "Emision",
    )
    || validateDatePair(
      filters.vencimiento_desde,
      filters.vencimiento_hasta,
      "Vencimiento",
    )
  );
}

export function formatAccountingReportLabel(value) {
  if (!value) {
    return "No disponible";
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return "No disponible";
  }

  const specialLabels = {
    CLP: "CLP",
    USD: "USD",
    EUR: "EUR",
    PAYPAL: "PayPal",
    MANUAL: "Manual",
    TRANSFERENCIA: "Transferencia bancaria",
    EFECTIVO: "Efectivo",
    OTRO: "Otro",
    PURCHASE: "Compra",
    EXAM: "Examen",
    HOSPITALIZATION: "Hospitalizacion",
    PROCEDURE: "Procedimiento",
    VET_CHECKUP: "Control veterinario",
    VET_CLINIC: "Clínica veterinaria",
    SUPPLIER: "Proveedor",
    INGRESO: "Ingreso",
    EGRESO: "Egreso",
    REEMBOLSO: "Reembolso",
    AJUSTE: "Ajuste",
    CONFIRMADA: "Confirmada",
    ANULADA: "Anulada",
    COMPLETADA: "Completada",
    CANCELADA: "Cancelada",
    FALLIDA: "Fallida",
    PENDIENTE: "Pendiente",
    PAGADA: "Pagada",
    PAGADA_PARCIAL: "Pagada parcial",
    VENCIDA: "Vencida",
    CONDONADA: "Condonada",
    REEMBOLSADA: "Reembolsada",
    PARCIALMENTE_REEMBOLSADA: "Parcialmente reembolsada",
    NORMAL: "Normal",
    FEE: "Fee",
    REFUND: "Reembolso",
    REVERSAL: "Reversa",
    DONACION_UNICA: "Donación única",
    PAYPAL_DONATION_CAPTURE: "Donación de PayPal",
    PAYPAL_DONATION_REFUND: "Reembolso de donación de PayPal",
    PAYPAL_DONATION_REVERSAL: "Reversa de donación de PayPal",
  };

  if (specialLabels[normalized]) {
    return specialLabels[normalized];
  }

  const cleaned = normalized.replace(/[_-]+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function formatAccountingReportMonthName(month) {
  const index = Number(month) - 1;
  return ACCOUNTING_REPORT_MONTH_NAMES[index] || "Mes no disponible";
}

export function formatAccountingReportPeriod(year, month) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);

  if (!Number.isInteger(normalizedYear) || !Number.isInteger(normalizedMonth)) {
    return "Periodo no disponible";
  }

  return `${formatAccountingReportMonthName(normalizedMonth)} de ${normalizedYear}`;
}

export function formatAccountingPublicReportState(value) {
  const labels = {
    BORRADOR: "Borrador",
    PUBLICADO: "Publicado",
    ARCHIVADO: "Archivado",
  };

  return labels[String(value || "").trim()] || "No disponible";
}

export function getAccountingPublicReportStateTone(state) {
  switch (state) {
    case "PUBLICADO":
      return "success";
    case "BORRADOR":
      return "warning";
    case "ARCHIVADO":
    default:
      return "neutral";
  }
}

export function isClosedMonthlyAccountingPeriod(year, month, now = new Date()) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);

  if (
    !Number.isInteger(normalizedYear)
    || !Number.isInteger(normalizedMonth)
    || normalizedMonth < 1
    || normalizedMonth > 12
  ) {
    return false;
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  return normalizedYear < currentYear
    || (normalizedYear === currentYear && normalizedMonth < currentMonth);
}

export function buildLatestClosedMonthlyAccountingPeriod(now = new Date()) {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (currentMonth === 1) {
    return {
      year: currentYear - 1,
      month: 12,
    };
  }

  return {
    year: currentYear,
    month: currentMonth - 1,
  };
}

function getMoneyFormatterConfig(currency = "CLP") {
  switch (currency) {
    case "USD":
      return {
        locale: "en-US",
        currencySymbol: "$",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
    case "EUR":
      return {
        locale: "de-DE",
        currencySymbol: "€",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      };
    case "CLP":
    default:
      return {
        locale: "es-CL",
        currencySymbol: "$",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      };
  }
}

export function formatAccountingReportMoney(value, currency = "CLP") {
  if (value === null || value === undefined || value === "") {
    return `${currency || "CLP"} -`;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return `${currency || "CLP"} -`;
  }

  const normalizedCurrency = String(currency || "CLP").toUpperCase();
  const formatterConfig = getMoneyFormatterConfig(normalizedCurrency);
  const formattedNumber = new Intl.NumberFormat(formatterConfig.locale, {
    minimumFractionDigits: formatterConfig.minimumFractionDigits,
    maximumFractionDigits: formatterConfig.maximumFractionDigits,
  }).format(amount);

  return `${normalizedCurrency} ${formatterConfig.currencySymbol}${formattedNumber}`.trim();
}

export function formatAccountingReportDate(value) {
  const date = parseSafeDate(value, { preferNoon: true });
  if (!date) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
}

export function formatAccountingReportDateTime(value) {
  const date = parseSafeDate(value);
  if (!date) {
    return "No disponible";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getAccountingReportStateTone(state) {
  switch (state) {
    case "CONFIRMADA":
    case "COMPLETADA":
    case "PAGADA":
      return "success";
    case "PAGADA_PARCIAL":
    case "PENDIENTE":
      return "warning";
    case "VENCIDA":
    case "FALLIDA":
      return "danger";
    case "ANULADA":
    case "CANCELADA":
    case "CONDONADA":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getAccountingReportTransactionTone(type) {
  switch (type) {
    case "INGRESO":
      return "success";
    case "EGRESO":
      return "danger";
    case "REEMBOLSO":
      return "warning";
    default:
      return "neutral";
  }
}

function buildSummaryMetric(label, value, type = "money") {
  return { label, value, type };
}

export function buildTransactionsSummarySections(summary = {}) {
  return (summary.currencies || []).map((currencySummary) => ({
    currency: currencySummary.currency,
    metrics: [
      buildSummaryMetric("Ingresos", currencySummary.ingresosBrutos),
      buildSummaryMetric("Egresos", currencySummary.egresosBrutos),
      buildSummaryMetric("Fees", currencySummary.fees),
      buildSummaryMetric("Refunds", currencySummary.refunds),
      buildSummaryMetric("Reversals", currencySummary.reversals),
      buildSummaryMetric("Resultado neto", currencySummary.resultadoNeto),
      buildSummaryMetric("Operaciones", currencySummary.operaciones, "count"),
    ],
  }));
}

export function buildPayablesSummarySections(summary = {}) {
  return (summary.currencies || []).map((currencySummary) => ({
    currency: currencySummary.currency,
    metrics: [
      buildSummaryMetric("Obligaciones", currencySummary.obligacionesTotal),
      buildSummaryMetric("Pagado", currencySummary.pagadoTotal),
      buildSummaryMetric("Saldo", currencySummary.saldoPendiente),
      buildSummaryMetric("Saldo vencido", currencySummary.saldoVencido),
      buildSummaryMetric("Cuentas", currencySummary.cuentas, "count"),
      buildSummaryMetric("Pendientes", currencySummary.pendientes, "count"),
      buildSummaryMetric("Parciales", currencySummary.parciales, "count"),
      buildSummaryMetric("Pagadas", currencySummary.pagadas, "count"),
      buildSummaryMetric("Vencidas", currencySummary.vencidas, "count"),
      buildSummaryMetric("Anuladas", currencySummary.anuladas, "count"),
      buildSummaryMetric("Condonadas", currencySummary.condonadas, "count"),
    ],
  }));
}

export function normalizeAccountingReportWarnings(warnings = []) {
  return (Array.isArray(warnings) ? warnings : []).reduce((items, warning) => {
    if (typeof warning === "string" && warning.trim()) {
      items.push(warning.trim());
      return items;
    }

    if (warning && typeof warning === "object") {
      const message = warning.message || warning.descripcion || warning.detail || warning.code;
      if (typeof message === "string" && message.trim()) {
        items.push(message.trim());
      }
    }

    return items;
  }, []);
}

export function formatCompactSummaryMetric(metric, currency, formatMoney) {
  if (metric.type === "count") {
    return `${metric.label}: ${new Intl.NumberFormat("es-CL").format(Number(metric.value || 0))}`;
  }

  return `${metric.label}: ${formatMoney(metric.value ?? 0, currency)}`;
}

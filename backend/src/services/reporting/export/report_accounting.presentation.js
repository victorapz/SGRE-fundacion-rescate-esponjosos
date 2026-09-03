"use strict";

function humanizeFallback(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "No disponible";
  }

  const cleaned = normalized.replace(/[_-]+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const ACCOUNTING_LABELS = {
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
  VET_CLINIC: "Clinica veterinaria",
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
  PAYPAL_DONATION_CAPTURE: "Donacion de PayPal",
  PAYPAL_DONATION_REFUND: "Reembolso de donacion de PayPal",
  PAYPAL_DONATION_REVERSAL: "Reversa de donacion de PayPal",
  true: "Si",
  false: "No",
};

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

export function formatAccountingExportLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "No disponible";
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return "No disponible";
  }

  return ACCOUNTING_LABELS[normalized] || humanizeFallback(normalized);
}

export function formatAccountingExportMoney(value, currency = "CLP") {
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

export function resolveAccountingXlsxMoneyFormat(currency = "CLP") {
  switch (String(currency || "CLP").toUpperCase()) {
    case "USD":
    case "EUR":
      return "#,##0.00";
    case "CLP":
    default:
      return "#,##0";
  }
}

export function buildDisplayFilterEntry(label, value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return {
    label,
    value: Array.isArray(value) ? value.join(", ") : String(value),
  };
}

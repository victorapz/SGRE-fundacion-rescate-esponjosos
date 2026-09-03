export const SUPPORTED_FINANCIAL_CURRENCIES = ["CLP", "USD", "EUR"];
export const PURCHASE_PAYMENT_STATUS_OPTIONS = ["PENDIENTE", "PAGADA", "PAGADA_PARCIAL"];

export function toNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function parseNullableDecimal(value) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeFinancialFields(item = {}) {
  return {
    montoTotal: toNullableNumber(item.monto_total),
    moneda: item.moneda || "CLP",
    generaCuentaPorPagar: Boolean(item.genera_cuenta_por_pagar),
    fechaVencimientoPago: item.fecha_vencimiento_pago || "",
    observacionFinanciera: item.observacion_financiera || "",
    precio: item.precio || "",
  };
}

export function formatMoney(value, currency = "CLP") {
  if (value === null || value === undefined || value === "") {
    return "Sin monto";
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "Sin monto";
  }

  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency || "CLP",
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency || "CLP"}`.trim();
  }
}

export function formatFinancialSummary(item = {}) {
  if (item?.montoTotal !== null && item?.montoTotal !== undefined && item?.montoTotal !== "") {
    return formatMoney(item.montoTotal, item.moneda);
  }

  if (item?.precio) {
    return `Legado: ${item.precio}`;
  }

  return "Sin monto";
}

export function buildLegacyPriceValue(montoTotal, precio) {
  if (montoTotal !== null && montoTotal !== undefined && montoTotal !== "") {
    return String(montoTotal);
  }

  const legacyValue = String(precio || "").trim();
  return legacyValue || null;
}

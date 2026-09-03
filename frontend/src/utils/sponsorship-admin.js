import { formatMoney } from "./financial.js";

export function formatSponsorshipMoney(value, currency = "CLP") {
  if (currency === "USD") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      return "Sin monto";
    }

    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "USD",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return formatMoney(value, currency);
}

export function addOneCalendarMonthFromDateInput(value) {
  if (!value) return "";

  const source = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(source.getTime())) {
    return "";
  }

  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const next = new Date(Date.UTC(year, month + 1, Math.min(day, lastDayOfTargetMonth)));

  return next.toISOString().slice(0, 10);
}

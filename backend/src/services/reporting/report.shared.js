"use strict";

import {
  REPORT_DEFAULT_DATE_RANGE_DAYS,
  REPORT_FIELD_TYPES,
  REPORT_MAX_DATE_RANGE_DAYS,
  REPORT_PREVIEW_DEFAULT_LIMIT,
  REPORT_PREVIEW_MAX_LIMIT,
  REPORT_SUPPORTED_CURRENCIES,
  REPORT_TIME_ZONE,
} from "./report.constants.js";

const REPORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CHILE_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const CHILE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const CHILE_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: REPORT_TIME_ZONE,
  timeZoneName: "shortOffset",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function padReportNumber(value) {
  return String(value).padStart(2, "0");
}

function buildIsoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${padReportNumber(month)}-${padReportNumber(day)}`;
}

function parseDateOffset(offsetLabel = "") {
  const normalized = String(offsetLabel || "").trim();

  if (normalized === "GMT" || normalized === "UTC") {
    return 0;
  }

  const match = normalized.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) {
    throw new Error(`No fue posible interpretar el offset de zona horaria: ${normalized}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);

  return sign * (((hours * 60) + minutes) * 60 * 1000);
}

function getChileOffsetMsForInstant(date) {
  const timeZoneName = CHILE_OFFSET_FORMATTER
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")
    ?.value;

  return parseDateOffset(timeZoneName);
}

function convertChileLocalDateTimeToUtc({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
}) {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let candidateMs = naiveUtcMs;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const offsetMs = getChileOffsetMsForInstant(new Date(candidateMs));
    const resolvedMs = naiveUtcMs - offsetMs;

    if (resolvedMs === candidateMs) {
      return new Date(resolvedMs);
    }

    candidateMs = resolvedMs;
  }

  return new Date(candidateMs);
}

function shiftReportDate(isoDate, daysDelta) {
  const parsed = parseReportDate(isoDate);
  const utcBase = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const shifted = new Date(utcBase + (daysDelta * 24 * 60 * 60 * 1000));

  return buildIsoDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

function diffReportDaysInclusive(fromIsoDate, toIsoDate) {
  const from = parseReportDate(fromIsoDate);
  const to = parseReportDate(toIsoDate);
  const fromMs = Date.UTC(from.year, from.month - 1, from.day);
  const toMs = Date.UTC(to.year, to.month - 1, to.day);

  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;
}

function buildChileTimestamp(date) {
  const parts = CHILE_DATE_TIME_FORMATTER.formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";

  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

export function parseReportDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = String(value).trim();
  if (!REPORT_DATE_REGEX.test(normalized)) {
    throw new Error("La fecha del informe debe tener formato YYYY-MM-DD.");
  }

  const [yearRaw, monthRaw, dayRaw] = normalized.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isValid = parsedDate.getUTCFullYear() === year
    && (parsedDate.getUTCMonth() + 1) === month
    && parsedDate.getUTCDate() === day;

  if (!isValid) {
    throw new Error("La fecha del informe no es valida.");
  }

  return {
    year,
    month,
    day,
    isoDate: normalized,
  };
}

export function getCurrentChileDateTime(now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const chileDate = CHILE_DATE_FORMATTER.format(current);

  return {
    now: current,
    isoInstant: current.toISOString(),
    chileDate,
    chileTimestamp: buildChileTimestamp(current),
    timeZone: REPORT_TIME_ZONE,
  };
}

export function buildChileReportDateRange({
  fecha_desde,
  fecha_hasta,
  fieldType = REPORT_FIELD_TYPES.TIMESTAMP,
  now = new Date(),
} = {}) {
  if (![REPORT_FIELD_TYPES.DATE, REPORT_FIELD_TYPES.TIMESTAMP].includes(fieldType)) {
    throw new Error("El tipo de campo del informe no es valido.");
  }

  const currentChileDate = getCurrentChileDateTime(now).chileDate;
  let normalizedFrom = parseReportDate(fecha_desde)?.isoDate || null;
  let normalizedTo = parseReportDate(fecha_hasta)?.isoDate || null;

  if (!normalizedFrom && !normalizedTo) {
    normalizedTo = currentChileDate;
    normalizedFrom = shiftReportDate(normalizedTo, -(REPORT_DEFAULT_DATE_RANGE_DAYS - 1));
  } else if (normalizedFrom && !normalizedTo) {
    normalizedTo = currentChileDate;
  } else if (!normalizedFrom && normalizedTo) {
    normalizedFrom = shiftReportDate(normalizedTo, -(REPORT_DEFAULT_DATE_RANGE_DAYS - 1));
  }

  if (normalizedFrom > normalizedTo) {
    throw new Error("fecha_desde no puede ser mayor que fecha_hasta.");
  }

  const inclusiveDayCount = diffReportDaysInclusive(normalizedFrom, normalizedTo);
  if (inclusiveDayCount > REPORT_MAX_DATE_RANGE_DAYS) {
    throw new Error(
      `El rango del informe no puede superar ${REPORT_MAX_DATE_RANGE_DAYS} dias.`,
    );
  }

  if (fieldType === REPORT_FIELD_TYPES.DATE) {
    return {
      fieldType,
      normalized: {
        fecha_desde: normalizedFrom,
        fecha_hasta: normalizedTo,
        time_zone: REPORT_TIME_ZONE,
      },
      fromInclusive: normalizedFrom,
      toInclusive: normalizedTo,
      toExclusive: shiftReportDate(normalizedTo, 1),
      dayCount: inclusiveDayCount,
    };
  }

  const fromParts = parseReportDate(normalizedFrom);
  const toParts = parseReportDate(normalizedTo);
  const nextDayParts = parseReportDate(shiftReportDate(normalizedTo, 1));

  const fromInclusive = convertChileLocalDateTimeToUtc({
    year: fromParts.year,
    month: fromParts.month,
    day: fromParts.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const toExclusive = convertChileLocalDateTimeToUtc({
    year: nextDayParts.year,
    month: nextDayParts.month,
    day: nextDayParts.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  return {
    fieldType,
    normalized: {
      fecha_desde: normalizedFrom,
      fecha_hasta: normalizedTo,
      time_zone: REPORT_TIME_ZONE,
    },
    fromInclusive,
    toExclusive,
    dayCount: inclusiveDayCount,
    localBounds: {
      fromInclusive: buildIsoDate(fromParts.year, fromParts.month, fromParts.day),
      toExclusive: buildIsoDate(nextDayParts.year, nextDayParts.month, nextDayParts.day),
    },
  };
}

export function normalizeReportPagination({ page, limit } = {}) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const requestedLimit = Number.parseInt(limit, 10);
  const normalizedLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), REPORT_PREVIEW_MAX_LIMIT)
    : REPORT_PREVIEW_DEFAULT_LIMIT;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
}

export function buildReportPaginationMeta({
  page,
  limit,
  total,
}) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || REPORT_PREVIEW_DEFAULT_LIMIT, 1),
    REPORT_PREVIEW_MAX_LIMIT,
  );
  const normalizedTotal = Math.max(Number.parseInt(total, 10) || 0, 0);
  const totalPages = Math.max(Math.ceil(normalizedTotal / normalizedLimit), 1);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    total: normalizedTotal,
    total_pages: totalPages,
    has_previous: normalizedPage > 1,
    has_next: normalizedPage < totalPages,
  };
}

export function normalizeReportCurrency(value, { allowNull = false } = {}) {
  if (value === null || value === undefined || value === "") {
    if (allowNull) return null;
    throw new Error("La moneda del informe es obligatoria.");
  }

  const normalized = String(value).trim().toUpperCase();
  if (!REPORT_SUPPORTED_CURRENCIES.includes(normalized)) {
    throw new Error(
      `La moneda del informe debe ser una de: ${REPORT_SUPPORTED_CURRENCIES.join(", ")}.`,
    );
  }

  return normalized;
}

export function toReportNumber(value, label = "El monto") {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    throw new Error(`${label} debe ser un numero finito.`);
  }

  return Number(normalized.toFixed(2));
}

export function accumulateCurrencyTotals(
  accumulator,
  currency,
  metrics = {},
) {
  const normalizedCurrency = normalizeReportCurrency(currency);
  const target = accumulator[normalizedCurrency] || {};

  for (const [metricKey, metricValue] of Object.entries(metrics)) {
    const currentValue = toReportNumber(target[metricKey] || 0, metricKey);
    const nextValue = toReportNumber(metricValue, metricKey);
    target[metricKey] = Number((currentValue + nextValue).toFixed(2));
  }

  accumulator[normalizedCurrency] = {
    moneda: normalizedCurrency,
    ...target,
  };

  return accumulator;
}

export function sanitizeSpreadsheetText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Las celdas numericas deben contener numeros finitos.");
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const stringValue = String(value);
  const trimmedStart = stringValue.trimStart();

  if (/^[=+\-@]/.test(trimmedStart)) {
    return `'${stringValue}`;
  }

  return stringValue;
}

export function buildReportGeneratedBy(user) {
  const id = user?.id_usuario ?? user?.id ?? null;
  const name = [
    user?.nombre,
    user?.apellido,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || user?.name || "Sistema";

  return {
    id,
    name,
  };
}

export function buildReportPreviewResponse({
  reportType,
  generatedBy,
  filters = {},
  summary = {},
  rows = [],
  pagination = null,
  warnings = [],
}) {
  return {
    report_type: reportType,
    generated_at: getCurrentChileDateTime().isoInstant,
    generated_timezone: REPORT_TIME_ZONE,
    generated_by: buildReportGeneratedBy(generatedBy),
    filters,
    summary,
    rows: Array.isArray(rows) ? rows : [],
    pagination: pagination || buildReportPaginationMeta({
      page: 1,
      limit: Array.isArray(rows) ? rows.length || REPORT_PREVIEW_DEFAULT_LIMIT : REPORT_PREVIEW_DEFAULT_LIMIT,
      total: Array.isArray(rows) ? rows.length : 0,
    }),
    warnings: Array.isArray(warnings)
      ? warnings.filter((warning) => typeof warning === "string" && warning.trim())
      : [],
  };
}

const REPORT_EXPORT_FORMATS = ["pdf", "xlsx"];

const REPORT_EXPORT_MIME_TYPES = {
  pdf: ["application/pdf", "application/octet-stream"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
  ],
};

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStringValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function sanitizeReportFilters(filters = {}, options = {}) {
  const {
    omitPagination = false,
  } = options;

  return Object.entries(filters || {}).reduce((accumulator, [key, rawValue]) => {
    if (omitPagination && (key === "page" || key === "limit")) {
      return accumulator;
    }

    const value = normalizeStringValue(rawValue);

    if (value === null || value === undefined) {
      return accumulator;
    }

    if (typeof value === "boolean") {
      accumulator[key] = value;
      return accumulator;
    }

    if (isFiniteNumber(value)) {
      accumulator[key] = value;
      return accumulator;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        accumulator[key] = value;
      }
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
}

export function assertReportExportFormat(format) {
  const normalized = String(format || "").trim().toLowerCase();

  if (!REPORT_EXPORT_FORMATS.includes(normalized)) {
    throw new Error("El formato de exportacion debe ser pdf o xlsx.");
  }

  return normalized;
}

export function parseContentDispositionFilename(headerValue = "") {
  const rawHeader = String(headerValue || "").trim();
  if (!rawHeader) {
    return null;
  }

  const utf8Match = rawHeader.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim()).replace(/^["']|["']$/g, "");
    } catch {
      return utf8Match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  const basicMatch = rawHeader.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (basicMatch?.[2]) {
    return basicMatch[2].trim();
  }

  return null;
}

export function sanitizeDownloadFilename(filename, fallback = "reporte") {
  const safeFallback = String(fallback || "reporte")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const normalized = String(filename || "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return safeFallback || "reporte";
  }

  return normalized;
}

export function buildSafeReportFilename(baseName, format, now = new Date()) {
  const normalizedFormat = assertReportExportFormat(format);
  const dateLabel = new Date(now).toISOString().slice(0, 10);
  const safeBaseName = sanitizeDownloadFilename(baseName, "reporte")
    .replace(/\s+/g, "-")
    .toLowerCase();

  return `${safeBaseName}-${dateLabel}.${normalizedFormat}`;
}

export function resolveReportFilename(headers = {}, fallbackBaseName, format) {
  const contentDisposition = headers?.["content-disposition"] || headers?.["Content-Disposition"];
  const detectedFilename = parseContentDispositionFilename(contentDisposition);
  const fallbackFilename = buildSafeReportFilename(fallbackBaseName, format);

  return sanitizeDownloadFilename(detectedFilename, fallbackFilename);
}

export function isBlobLike(value) {
  return Boolean(value)
    && typeof value === "object"
    && typeof value.size === "number"
    && typeof value.type === "string"
    && typeof value.text === "function";
}

function isJsonContentType(contentType = "") {
  return String(contentType || "").toLowerCase().includes("application/json");
}

export function ensureExpectedReportContentType(contentType, format) {
  const normalizedFormat = assertReportExportFormat(format);
  const normalizedType = String(contentType || "").toLowerCase();

  if (!normalizedType) {
    return true;
  }

  return REPORT_EXPORT_MIME_TYPES[normalizedFormat].some((allowedType) =>
    normalizedType.includes(allowedType.toLowerCase()));
}

export async function extractReportExportErrorMessage({
  status,
  data,
  fallbackMessage = "No fue posible generar el informe.",
} = {}) {
  if (status === 403) {
    return "No tienes permisos para generar este informe.";
  }

  if (!isBlobLike(data)) {
    if (status === 422) {
      return "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente.";
    }

    return fallbackMessage;
  }

  const contentType = data.type || "";
  if (!isJsonContentType(contentType)) {
    if (status === 422) {
      return "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente.";
    }

    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(await data.text());
    const message = normalizeStringValue(parsed?.message);

    if (status === 422) {
      return message || "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente.";
    }

    return message || fallbackMessage;
  } catch {
    if (status === 422) {
      return "El informe contiene demasiados registros. Acota los filtros e intenta nuevamente.";
    }

    return fallbackMessage;
  }
}

export function isAbortError(error) {
  return error?.code === "ERR_CANCELED" || error?.name === "CanceledError";
}

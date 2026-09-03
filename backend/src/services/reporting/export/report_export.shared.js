"use strict";

import path from "node:path";
import { REPORT_TYPES } from "../report.constants.js";
import { getCurrentChileDateTime } from "../report.shared.js";
import {
  REPORT_EXPORT_FILENAME_BASES,
  REPORT_EXPORT_MIME_TYPES,
  REPORT_EXPORT_PDF_MAX_RECORDS,
  REPORT_EXPORT_PUBLIC_LIMIT_MESSAGE,
  REPORT_EXPORT_XLSX_MAX_RECORDS,
} from "./report_export.constants.js";

const CHILE_DATE_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CHILE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-CL", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatExportDate(value) {
  if (!value) return "";
  const normalized = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-").map(Number);
    return CHILE_DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return normalized;

  return CHILE_DATE_FORMATTER.format(parsed);
}

export function formatExportDateTime(value) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return CHILE_DATE_TIME_FORMATTER.format(parsed);
}

function sanitizeFilenameSegment(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function resolveDateSegment(filters = {}) {
  const candidates = [
    [filters.fecha_desde, filters.fecha_hasta],
    [filters.fecha_emision_desde, filters.fecha_emision_hasta],
    [filters.vencimiento_desde, filters.vencimiento_hasta],
  ];

  for (const [from, to] of candidates) {
    if (from && to) {
      return `${sanitizeFilenameSegment(from)}-a-${sanitizeFilenameSegment(to)}`;
    }

    if (from) return sanitizeFilenameSegment(from);
    if (to) return sanitizeFilenameSegment(to);
  }

  return sanitizeFilenameSegment(getCurrentChileDateTime().chileDate);
}

export function buildReportExportFilename(reportType, filters = {}, format = "pdf") {
  const baseName = REPORT_EXPORT_FILENAME_BASES[reportType] || "informe";
  const segment = resolveDateSegment(filters);
  const safeName = sanitizeFilenameSegment(baseName);
  return `${safeName}-${segment}.${sanitizeFilenameSegment(format)}`;
}

export function getReportExportRecordCount(report = {}) {
  if (report.report_type === REPORT_TYPES.ACCOUNTING_PAYABLES) {
    return (report.rows?.length || 0) + (report.payments?.length || 0);
  }

  if (report.report_type === REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS) {
    const countDetails = (report.counts || []).reduce(
      (acc, row) => acc + (row.detalles?.length || 0),
      0,
    );
    const adjustmentDetails = (report.adjustments || []).reduce(
      (acc, row) => acc + (row.detalles?.length || 0),
      0,
    );

    return (report.counts?.length || 0)
      + (report.adjustments?.length || 0)
      + countDetails
      + adjustmentDetails;
  }

  return report.rows?.length || report.total_rows || 0;
}

export function assertReportExportWithinLimit(report = {}, format = "pdf") {
  const totalRecords = getReportExportRecordCount(report);
  const maxRecords = format === "pdf"
    ? REPORT_EXPORT_PDF_MAX_RECORDS
    : REPORT_EXPORT_XLSX_MAX_RECORDS;

  if (totalRecords > maxRecords) {
    const error = new Error(
      `${REPORT_EXPORT_PUBLIC_LIMIT_MESSAGE} Registros encontrados: ${totalRecords}. Maximo permitido: ${maxRecords}.`,
    );
    error.statusCode = 422;
    throw error;
  }
}

export function applyReportBinaryHeaders(res, { filename, format }) {
  res.setHeader("Content-Type", REPORT_EXPORT_MIME_TYPES[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filename)}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
}

export function buildFilterEntries(filters = {}) {
  if (Array.isArray(filters?.display_filters)) {
    return filters.display_filters
      .filter((entry) => entry?.label && entry?.value !== null && entry?.value !== undefined && entry?.value !== "");
  }

  return Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      label: key,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }));
}

export function buildWarningMessages(report = {}) {
  if (Array.isArray(report.warning_details) && report.warning_details.length > 0) {
    return report.warning_details.map((warning) => warning.message);
  }

  return Array.isArray(report.warnings) ? report.warnings : [];
}

export function buildGeneratedMetadata(report = {}) {
  const generatedAt = getCurrentChileDateTime();
  return {
    generated_at: generatedAt.isoInstant,
    generated_label: formatExportDateTime(generatedAt.isoInstant),
    generated_by: report.generated_by?.name || "Sistema",
  };
}

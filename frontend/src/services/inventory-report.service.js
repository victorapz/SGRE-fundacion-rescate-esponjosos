import api from "../api/axios";
import {
  assertReportExportFormat,
  buildSafeReportFilename,
  ensureExpectedReportContentType,
  extractReportExportErrorMessage,
  isAbortError,
  isBlobLike,
  resolveReportFilename,
  sanitizeReportFilters,
} from "./accounting-report.service.shared";

function extractData(response) {
  return response?.data?.data ?? null;
}

function buildRequestError(error, fallbackMessage) {
  const message = error?.response?.data?.message || error?.message || fallbackMessage;
  const details = error?.response?.data?.details;

  if (Array.isArray(details) && details.length > 0) {
    return new Error(`${message}: ${details.join(", ")}`);
  }

  if (typeof details === "string" && details.trim()) {
    return new Error(`${message}: ${details.trim()}`);
  }

  return new Error(message);
}

function normalizePagination(pagination = {}) {
  return {
    page: Number(pagination.page || 1),
    limit: Number(pagination.limit || 20),
    total: Number(pagination.total || 0),
    totalPages: Number(pagination.total_pages || 1),
    hasPrevious: Boolean(pagination.has_previous),
    hasNext: Boolean(pagination.has_next),
  };
}

function normalizeWarningItem(item) {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }

  if (item && typeof item === "object") {
    const message = item.message || item.descripcion || item.detail || item.code;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return null;
}

function normalizeWarnings(items = []) {
  return Array.isArray(items)
    ? items.map(normalizeWarningItem).filter(Boolean)
    : [];
}

function normalizeUserSummary(item = {}) {
  if (!item) {
    return null;
  }

  return {
    id: Number(item.id || 0),
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    email: item.email || "",
  };
}

function normalizeLocationSummary(item = {}) {
  if (!item) {
    return null;
  }

  return {
    id: Number(item.id || 0),
    nombre: item.nombre || "",
    tipo: item.tipo || "",
    activa: item.activa !== undefined ? Boolean(item.activa) : true,
  };
}

function normalizeCategorySummary(item = {}) {
  if (!item) {
    return null;
  }

  return {
    id: Number(item.id || 0),
    nombre: item.nombre || "",
  };
}

function normalizeUnitSummary(item = {}) {
  if (!item) {
    return null;
  }

  return {
    id: Number(item.id || 0),
    nombre: item.nombre || "",
    abreviatura: item.abreviatura || "",
  };
}

function normalizeItemSummary(item = {}) {
  if (!item) {
    return null;
  }

  return {
    id: Number(item.id || 0),
    nombre: item.nombre || "",
    codigo: item.codigo || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
  };
}

function normalizeReportBase(data = {}) {
  return {
    reportType: data.report_type || "",
    generatedAt: data.generated_at || "",
    generatedTimezone: data.generated_timezone || "",
    generatedBy: normalizeUserSummary(data.generated_by),
    filters: data.filters || {},
    warnings: normalizeWarnings(data.warnings),
    warningDetails: normalizeWarnings(data.warning_details),
  };
}

function normalizeExistenceRow(row = {}) {
  return {
    existenceId: Number(row.existence_id || 0),
    item: normalizeItemSummary(row.item),
    categoria: normalizeCategorySummary(row.categoria),
    unidad: normalizeUnitSummary(row.unidad),
    ubicacion: normalizeLocationSummary(row.ubicacion),
    cantidadActual: Number(row.cantidad_actual || 0),
    stockMinimo:
      row.stock_minimo === null || row.stock_minimo === undefined
        ? null
        : Number(row.stock_minimo),
    diferenciaMinimo:
      row.diferencia_minimo === null || row.diferencia_minimo === undefined
        ? null
        : Number(row.diferencia_minimo),
    estadoStock: row.estado_stock || "",
    aggregation: {
      persistenceRows: Number(row.aggregation?.persistence_rows || 0),
      heterogeneous: Boolean(row.aggregation?.heterogeneous),
      mixedFields: Array.isArray(row.aggregation?.mixed_fields)
        ? row.aggregation.mixed_fields
        : [],
    },
    actualizadoEn: row.actualizado_en || "",
  };
}

function normalizeExistencesReport(data = {}) {
  const base = normalizeReportBase(data);

  return {
    ...base,
    summary: data.summary || {},
    pagination: normalizePagination(data.pagination || {}),
    rows: Array.isArray(data.rows) ? data.rows.map(normalizeExistenceRow) : [],
  };
}

function normalizeCountDetail(detail = {}) {
  return {
    detailId: Number(detail.detail_id || 0),
    item: normalizeItemSummary(detail.item),
    categoria: normalizeCategorySummary(detail.categoria),
    unidad: normalizeUnitSummary(detail.unidad),
    existenciaId: detail.existencia_id ? Number(detail.existencia_id) : null,
    cantidadTeorica:
      detail.cantidad_teorica === null || detail.cantidad_teorica === undefined
        ? null
        : Number(detail.cantidad_teorica),
    cantidadContada:
      detail.cantidad_contada === null || detail.cantidad_contada === undefined
        ? null
        : Number(detail.cantidad_contada),
    diferencia:
      detail.diferencia === null || detail.diferencia === undefined
        ? null
        : Number(detail.diferencia),
    clasificacion: detail.clasificacion || "",
    dataQuality: detail.data_quality || "",
    ajusteVinculado: detail.ajuste_vinculado
      ? {
          adjustmentId: Number(detail.ajuste_vinculado.adjustment_id || 0),
          detailId: Number(detail.ajuste_vinculado.detail_id || 0),
        }
      : null,
    observaciones: detail.observaciones || "",
  };
}

function normalizeAdjustmentDetail(detail = {}) {
  return {
    detailId: Number(detail.detail_id || 0),
    item: normalizeItemSummary(detail.item),
    categoria: normalizeCategorySummary(detail.categoria),
    unidad: normalizeUnitSummary(detail.unidad),
    existenciaId: detail.existencia_id ? Number(detail.existencia_id) : null,
    cantidadAnterior:
      detail.cantidad_anterior === null || detail.cantidad_anterior === undefined
        ? null
        : Number(detail.cantidad_anterior),
    cantidadAjustada:
      detail.cantidad_ajustada === null || detail.cantidad_ajustada === undefined
        ? null
        : Number(detail.cantidad_ajustada),
    cantidadPosterior:
      detail.cantidad_posterior === null || detail.cantidad_posterior === undefined
        ? null
        : Number(detail.cantidad_posterior),
    impacto: detail.impacto || "",
    diferenciaAplicada:
      detail.diferencia_aplicada === null || detail.diferencia_aplicada === undefined
        ? null
        : Number(detail.diferencia_aplicada),
    tipoAjuste: detail.tipo_ajuste || "",
  };
}

function normalizeCountRow(row = {}) {
  return {
    countId: Number(row.count_id || 0),
    fecha: row.fecha || "",
    ubicacion: normalizeLocationSummary(row.ubicacion),
    responsable: normalizeUserSummary(row.responsable),
    observaciones: row.observaciones || "",
    itemsContados: Number(row.items_contados || 0),
    itemsConDiferencia: Number(row.items_con_diferencia || 0),
    sobrantes: Number(row.sobrantes || 0),
    faltantes: Number(row.faltantes || 0),
    sinDiferencia: Number(row.sin_diferencia || 0),
    adjustmentsTotal: Number(row.adjustments_total || 0),
    adjustments: Array.isArray(row.adjustments)
      ? row.adjustments.map((adjustment) => ({
          adjustmentId: Number(adjustment.adjustment_id || 0),
          fecha: adjustment.fecha || "",
          estado: adjustment.estado || "",
          motivo: adjustment.motivo || "",
        }))
      : [],
    detailsTotal: Number(row.details_total || 0),
    detailsTruncated: Boolean(row.details_truncated),
    detalles: Array.isArray(row.detalles) ? row.detalles.map(normalizeCountDetail) : [],
  };
}

function normalizeAdjustmentRow(row = {}) {
  return {
    adjustmentId: Number(row.adjustment_id || 0),
    fecha: row.fecha || "",
    estado: row.estado || "",
    motivo: row.motivo || "",
    observaciones: row.observaciones || "",
    ubicacion: normalizeLocationSummary(row.ubicacion),
    responsable: normalizeUserSummary(row.responsable),
    conteoOrigen: row.conteo_origen
      ? {
          id: Number(row.conteo_origen.id || 0),
          fecha: row.conteo_origen.fecha || "",
        }
      : null,
    itemsAjustados: Number(row.items_ajustados || 0),
    incrementos: Number(row.incrementos || 0),
    disminuciones: Number(row.disminuciones || 0),
    movementsTotal: Number(row.movements_total || 0),
    movementIds: Array.isArray(row.movement_ids)
      ? row.movement_ids.map((movementId) => Number(movementId || 0)).filter(Boolean)
      : [],
    detailsTotal: Number(row.details_total || 0),
    detailsTruncated: Boolean(row.details_truncated),
    detalles: Array.isArray(row.detalles) ? row.detalles.map(normalizeAdjustmentDetail) : [],
  };
}

function normalizeCountsAdjustmentsReport(data = {}) {
  const base = normalizeReportBase(data);

  return {
    ...base,
    summary: data.summary || {},
    counts: {
      rows: Array.isArray(data.counts?.rows) ? data.counts.rows.map(normalizeCountRow) : [],
      pagination: normalizePagination(data.counts?.pagination || {}),
    },
    adjustments: {
      rows: Array.isArray(data.adjustments?.rows)
        ? data.adjustments.rows.map(normalizeAdjustmentRow)
        : [],
      pagination: normalizePagination(data.adjustments?.pagination || {}),
    },
  };
}

async function getReportPreview(path, filters, normalizer, options = {}) {
  try {
    const response = await api.get(path, {
      params: sanitizeReportFilters(filters),
      signal: options.signal,
    });

    return normalizer(extractData(response) || {});
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw buildRequestError(error, "No fue posible obtener la vista previa del informe.");
  }
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

async function exportReport(path, filters, format, fallbackBaseName, options = {}) {
  const normalizedFormat = assertReportExportFormat(format);

  try {
    const response = await api.get(path, {
      params: {
        ...sanitizeReportFilters(filters, { omitPagination: true }),
        format: normalizedFormat,
      },
      responseType: "blob",
      signal: options.signal,
    });
    const blob = isBlobLike(response.data)
      ? response.data
      : new Blob([response.data], {
          type: response?.headers?.["content-type"] || "",
        });
    const contentType = response?.headers?.["content-type"] || blob.type || "";

    if (contentType.includes("application/json")) {
      const message = await extractReportExportErrorMessage({
        status: response?.status,
        data: blob,
      });
      throw new Error(message);
    }

    if (!blob.size) {
      throw new Error("No fue posible generar el informe.");
    }

    if (!ensureExpectedReportContentType(contentType, normalizedFormat)) {
      throw new Error("No fue posible generar el informe.");
    }

    const filename = resolveReportFilename(
      response?.headers,
      fallbackBaseName,
      normalizedFormat,
    ) || buildSafeReportFilename(fallbackBaseName, normalizedFormat);

    downloadBlob(blob, filename);

    return {
      filename,
      contentType,
      size: blob.size,
      format: normalizedFormat,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (error instanceof Error && !error.response) {
      throw error;
    }

    const message = await extractReportExportErrorMessage({
      status: error?.response?.status,
      data: error?.response?.data,
    });
    throw new Error(message);
  }
}

export async function getInventoryExistencesReport(filters = {}, options = {}) {
  return getReportPreview(
    "/inventory/reports/existences",
    filters,
    normalizeExistencesReport,
    options,
  );
}

export async function getInventoryCountsAdjustmentsReport(filters = {}, options = {}) {
  return getReportPreview(
    "/inventory/reports/counts-adjustments",
    filters,
    normalizeCountsAdjustmentsReport,
    options,
  );
}

export async function exportInventoryExistencesReport(filters = {}, format, options = {}) {
  return exportReport(
    "/inventory/reports/existences/export",
    filters,
    format,
    "informe-inventario-existencias",
    options,
  );
}

export async function exportInventoryCountsAdjustmentsReport(filters = {}, format, options = {}) {
  return exportReport(
    "/inventory/reports/counts-adjustments/export",
    filters,
    format,
    "informe-inventario-conteos-ajustes",
    options,
  );
}

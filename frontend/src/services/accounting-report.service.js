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

function normalizeReportBase(data = {}) {
  return {
    reportType: data.report_type || "",
    generatedAt: data.generated_at || "",
    generatedTimezone: data.generated_timezone || "",
    generatedBy: {
      id: data.generated_by?.id || "",
      name: data.generated_by?.name || "Sistema",
    },
    filters: data.filters || {},
    pagination: normalizePagination(data.pagination || {}),
    warnings: normalizeWarnings(data.warnings),
  };
}

function normalizeTransactionSummary(summary = {}) {
  const currencies = Object.values(summary.monedas || {}).map((bucket) => ({
    currency: bucket.moneda || "CLP",
    ingresosBrutos: Number(bucket.ingresos_brutos || 0),
    egresosBrutos: Number(bucket.egresos_brutos || 0),
    fees: Number(bucket.fees || 0),
    refunds: Number(bucket.refunds || 0),
    reversals: Number(bucket.reversals || 0),
    resultadoNeto: Number(bucket.resultado_neto || 0),
    operaciones: Number(bucket.operaciones || 0),
  }));

  return {
    totalOperations: Number(summary.operaciones_totales || 0),
    categories: Array.isArray(summary.categorias) ? summary.categorias : [],
    types: Array.isArray(summary.tipos) ? summary.tipos : [],
    includedStates: Array.isArray(summary.estados_incluidos) ? summary.estados_incluidos : [],
    currencies,
    raw: summary,
  };
}

function normalizeTransactionsRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: Number(row.id || 0),
        fecha: row.fecha || "",
        tipo: row.tipo || "",
        estado: row.estado || "",
        clasificacion: row.clasificacion || "",
        categoria: row.categoria
          ? {
              id: Number(row.categoria.id || 0),
              clave: row.categoria.clave || "",
              nombre: row.categoria.nombre || "",
              tipo: row.categoria.tipo || "",
            }
          : null,
        descripcion: row.descripcion || "",
        montoBruto: Number(row.monto_bruto || 0),
        montoFee: Number(row.monto_fee || 0),
        montoNeto: Number(row.monto_neto || 0),
        moneda: row.moneda || "CLP",
        proveedorPago: row.proveedor_pago
          ? {
              id: Number(row.proveedor_pago.id || 0),
              clave: row.proveedor_pago.clave || "",
              nombre: row.proveedor_pago.nombre || "",
              tipo: row.proveedor_pago.tipo || "",
            }
          : null,
        referenciaExterna: row.referencia_externa || "",
        origen: row.origen || "",
      }))
    : [];
}

function normalizeTransactionsReport(data = {}) {
  const base = normalizeReportBase(data);

  return {
    ...base,
    summary: normalizeTransactionSummary(data.summary || {}),
    rows: normalizeTransactionsRows(data.rows),
  };
}

function normalizePayablesSummary(summary = {}) {
  const currencies = Object.values(summary.monedas || {}).map((bucket) => ({
    currency: bucket.moneda || "CLP",
    obligacionesTotal: Number(bucket.obligaciones_total || 0),
    pagadoTotal: Number(bucket.pagado_total || 0),
    saldoPendiente: Number(bucket.saldo_pendiente || 0),
    saldoVencido: Number(bucket.saldo_vencido || 0),
    cuentas: Number(bucket.cuentas || 0),
    pendientes: Number(bucket.pendientes || 0),
    parciales: Number(bucket.parciales || 0),
    pagadas: Number(bucket.pagadas || 0),
    vencidas: Number(bucket.vencidas || 0),
    anuladas: Number(bucket.anuladas || 0),
    condonadas: Number(bucket.condonadas || 0),
  }));

  return {
    totalAccounts: Number(summary.cuentas_totales || 0),
    includedStates: Array.isArray(summary.estados_incluidos) ? summary.estados_incluidos : [],
    origins: Array.isArray(summary.origenes)
      ? summary.origenes.map((origin) => ({
          ...origin,
          moneda: origin.moneda || "",
        }))
      : [],
    currencies,
    raw: summary,
  };
}

function normalizePayablesRows(rows = []) {
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: Number(row.id || 0),
        fecha: row.fecha || "",
        fechaVencimiento: row.fecha_vencimiento || "",
        concepto: row.concepto || "",
        descripcion: row.descripcion || "",
        estado: row.estado || "",
        moneda: row.moneda || "CLP",
        montoOriginal: Number(row.monto_original || 0),
        montoPagado: Number(row.monto_pagado || 0),
        saldoPendiente: Number(row.saldo_pendiente || 0),
        categoria: row.categoria
          ? {
              id: Number(row.categoria.id || 0),
              clave: row.categoria.clave || "",
              nombre: row.categoria.nombre || "",
            }
          : null,
        contraparte: row.contraparte
          ? {
              tipo: row.contraparte.tipo || "",
              id: Number(row.contraparte.id || 0),
              nombre: row.contraparte.nombre || "",
            }
          : null,
        origen: row.origen
          ? {
              tipo: row.origen.tipo || "",
              idVisible: row.origen.id_visible || "",
              descripcion: row.origen.descripcion || "",
            }
          : null,
        pagos: {
          cantidad: Number(row.pagos?.cantidad || 0),
          ultimaFechaPago: row.pagos?.ultima_fecha_pago || "",
          montoPagadoAcumulado: Number(row.pagos?.monto_pagado_acumulado || 0),
        },
      }))
    : [];
}

function normalizePayablesReport(data = {}) {
  const base = normalizeReportBase(data);

  return {
    ...base,
    summary: normalizePayablesSummary(data.summary || {}),
    rows: normalizePayablesRows(data.rows),
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

export async function getAccountingTransactionsReport(filters = {}, options = {}) {
  return getReportPreview(
    "/accounting/reports/transactions",
    filters,
    normalizeTransactionsReport,
    options,
  );
}

export async function getPayablesReport(filters = {}, options = {}) {
  return getReportPreview(
    "/accounting/reports/payables",
    filters,
    normalizePayablesReport,
    options,
  );
}

export async function exportAccountingTransactionsReport(filters = {}, format, options = {}) {
  return exportReport(
    "/accounting/reports/transactions/export",
    filters,
    format,
    "informe-contable-movimientos",
    options,
  );
}

export async function exportPayablesReport(filters = {}, format, options = {}) {
  return exportReport(
    "/accounting/reports/payables/export",
    filters,
    format,
    "informe-contable-cuentas-por-pagar",
    options,
  );
}

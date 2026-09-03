import api from "../api/axios.js";
import {
  ensureExpectedReportContentType,
  extractReportExportErrorMessage,
  isBlobLike,
  resolveReportFilename,
} from "./accounting-report.service.shared.js";
import { buildPublicRequestConfig, getPublicHttpErrorMessage } from "../utils/publicSite.js";

const ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH = "/accounting/public-reports";
const PUBLIC_ACCOUNTING_REPORTS_PATH = "/public/accounting-reports";

function normalizePagination(payload = {}, fallbackLimit = 10) {
  return payload.pagination || {
    page: 1,
    limit: fallbackLimit,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}

function normalizeCategoryRows(rows = [], fallbackLabel) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    category: row?.categoria || fallbackLabel,
    amount: Number(row?.monto || 0),
  }));
}

export function normalizePublicAccountingReportSnapshot(snapshot = {}) {
  const period = snapshot?.periodo || {};

  return {
    period: {
      year: Number(period.anio || 0),
      month: Number(period.mes || 0),
      from: period.fecha_desde || "",
      to: period.fecha_hasta || "",
    },
    currencies: (Array.isArray(snapshot?.monedas) ? snapshot.monedas : []).map((currencyRow) => ({
      currency: currencyRow?.moneda || "CLP",
      incomeTotal: Number(currencyRow?.ingresos_total || 0),
      expenseTotal: Number(currencyRow?.egresos_total || 0),
      periodResult: Number(currencyRow?.resultado_periodo || 0),
      incomeCategories: normalizeCategoryRows(
        currencyRow?.ingresos_por_categoria,
        "Otros ingresos",
      ),
      expenseCategories: normalizeCategoryRows(
        currencyRow?.egresos_por_categoria,
        "Otros egresos",
      ),
    })),
  };
}

export function mapAdminPublicAccountingReport(item = {}) {
  return {
    id: Number(item.id || 0),
    year: Number(item.year || 0),
    month: Number(item.month || 0),
    version: Number(item.version || 0),
    status: item.status || "BORRADOR",
    generatedAt: item.generated_at || "",
    publishedAt: item.published_at || "",
    archivedAt: item.archived_at || "",
    currencies: Array.isArray(item.currencies) ? item.currencies.filter(Boolean) : [],
    snapshot: item.snapshot ? normalizePublicAccountingReportSnapshot(item.snapshot) : null,
  };
}

export function mapPublishedAccountingReport(item = {}) {
  return {
    id: Number(item.id || 0),
    year: Number(item.year || 0),
    month: Number(item.month || 0),
    publishedAt: item.published_at || "",
    currencies: Array.isArray(item.currencies) ? item.currencies.filter(Boolean) : [],
    snapshot: item.snapshot ? normalizePublicAccountingReportSnapshot(item.snapshot) : null,
  };
}

function buildSafeError(error, fallbackMessage) {
  return new Error(getPublicHttpErrorMessage(error, fallbackMessage));
}

async function triggerPdfDownload(response, fallbackBaseName) {
  const blob = response?.data;
  const contentType = blob?.type || response?.headers?.["content-type"] || "";

  if (!isBlobLike(blob) || blob.size <= 0 || !ensureExpectedReportContentType(contentType, "pdf")) {
    const message = await extractReportExportErrorMessage({
      status: response?.status,
      data: blob,
      fallbackMessage: "No fue posible descargar el PDF.",
    });
    throw new Error(message);
  }

  if (
    typeof globalThis.window === "undefined"
    || typeof globalThis.document === "undefined"
    || typeof globalThis.URL?.createObjectURL !== "function"
    || typeof globalThis.URL?.revokeObjectURL !== "function"
  ) {
    throw new Error("No fue posible descargar el PDF.");
  }

  const downloadUrl = globalThis.URL.createObjectURL(blob);
  const link = globalThis.document.createElement("a");

  try {
    link.href = downloadUrl;
    link.download = resolveReportFilename(response?.headers, fallbackBaseName, "pdf");
    link.rel = "noopener";
    globalThis.document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    globalThis.URL.revokeObjectURL(downloadUrl);
  }
}

export async function listAdminPublicReports({ page = 1, limit = 10 } = {}) {
  try {
    const response = await api.get(ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH, {
      params: { page, limit },
    });
    const payload = response?.data?.data || {};

    return {
      items: (Array.isArray(payload.items) ? payload.items : []).map(mapAdminPublicAccountingReport),
      pagination: normalizePagination(payload, limit),
    };
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar los informes.");
  }
}

export async function getAdminPublicReport(id) {
  try {
    const response = await api.get(
      `${ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}`,
    );

    return mapAdminPublicAccountingReport(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar el detalle del informe.");
  }
}

export async function generatePublicReport({ year, month }) {
  try {
    const response = await api.post(`${ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH}/generate`, {
      year: Number(year),
      month: Number(month),
    });

    return mapAdminPublicAccountingReport(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible generar el borrador.");
  }
}

export async function publishPublicReport(id) {
  try {
    const response = await api.patch(
      `${ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}/publish`,
    );

    return mapAdminPublicAccountingReport(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible publicar el informe.");
  }
}

export async function archivePublicReport(id) {
  try {
    const response = await api.patch(
      `${ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}/archive`,
    );

    return mapAdminPublicAccountingReport(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible archivar el informe.");
  }
}

export async function downloadAdminPublicReport(id) {
  try {
    const response = await api.get(
      `${ADMIN_PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}/download`,
      {
        responseType: "blob",
      },
    );

    await triggerPdfDownload(response, "informe-financiero");
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw buildSafeError(error, "No fue posible descargar el PDF.");
  }
}

export async function listPublishedAccountingReports({ page = 1, limit = 9 } = {}) {
  try {
    const response = await api.get(
      PUBLIC_ACCOUNTING_REPORTS_PATH,
      buildPublicRequestConfig({
        params: { page, limit },
      }),
    );
    const payload = response?.data?.data || {};

    return {
      items: (Array.isArray(payload.items) ? payload.items : []).map(mapPublishedAccountingReport),
      pagination: normalizePagination(payload, limit),
    };
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar los informes.");
  }
}

export async function getPublishedAccountingReport(id) {
  try {
    const response = await api.get(
      `${PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}`,
      buildPublicRequestConfig(),
    );

    return mapPublishedAccountingReport(response?.data?.data || {});
  } catch (error) {
    throw buildSafeError(error, "No fue posible cargar el informe.");
  }
}

export async function downloadPublishedAccountingReport(id) {
  try {
    const response = await api.get(
      `${PUBLIC_ACCOUNTING_REPORTS_PATH}/${encodeURIComponent(id)}/download`,
      buildPublicRequestConfig({
        responseType: "blob",
      }),
    );

    await triggerPdfDownload(response, "informe-financiero");
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw buildSafeError(error, "No fue posible descargar el PDF.");
  }
}

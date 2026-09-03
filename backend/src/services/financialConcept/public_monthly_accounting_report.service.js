"use strict";

import { In } from "typeorm";
import { MINIO_BUCKETS } from "../../config/minio.config.js";
import PublicMonthlyAccountingReport, {
  PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS,
} from "../../entities/financialConcept/public_monthly_accounting_report.entity.js";
import TransactionCategory from "../../entities/financialConcept/transaction_category.entity.js";
import {
  AppDataSource,
  User,
  buildPagedResult,
  buildPagination,
} from "./accounting.shared.js";
import { buildAccountingTransactionsReportDataset } from "./accounting_report.service.js";
import { uploadBuffer, removeObject, getObjectStream } from "../minio.service.js";
import {
  getCurrentChileDateTime,
  toReportNumber,
} from "../reporting/report.shared.js";
import { generatePublicMonthlyAccountingReportPdfBuffer } from "./publicMonthlyAccountingReport.pdf.js";

const PUBLIC_REPORT_PDF_CONTENT_TYPE = "application/pdf";

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function toPositiveInteger(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
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

function buildMonthBounds(year, month) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    fecha_desde: firstDay,
    fecha_hasta: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

function isFutureMonthlyPeriod(year, month, now = new Date()) {
  const chileDate = getCurrentChileDateTime(now).chileDate;
  const [currentYear, currentMonth] = String(chileDate).split("-").map(Number);
  return year > currentYear || (year === currentYear && month > currentMonth);
}

function normalizeCategoryLabel(categoryRecord, amount) {
  const parentName = categoryRecord?.categoria_padre?.nombre || null;
  const categoryName = categoryRecord?.nombre || null;
  const resolvedName = parentName || categoryName;

  if (resolvedName) {
    return resolvedName;
  }

  return amount >= 0 ? "Otros ingresos" : "Otros egresos";
}

function sortCategoryRows(rows = []) {
  return [...rows].sort((left, right) => {
    if ((right.monto || 0) !== (left.monto || 0)) {
      return (right.monto || 0) - (left.monto || 0);
    }

    return String(left.categoria || "").localeCompare(String(right.categoria || ""), "es");
  });
}

export function buildPublicMonthlyAccountingSnapshot(summary = {}, categoryLookup = new Map(), period) {
  const currencies = Object.keys(summary?.monedas || {});
  const categories = Array.isArray(summary?.categorias) ? summary.categorias : [];

  const bucketsByCurrency = new Map();
  for (const currency of currencies) {
    bucketsByCurrency.set(currency, {
      moneda: currency,
      ingresos_total: 0,
      egresos_total: 0,
      resultado_periodo: 0,
      ingresos_por_categoria: new Map(),
      egresos_por_categoria: new Map(),
    });
  }

  for (const categoryBucket of categories) {
    const currency = categoryBucket.moneda || "CLP";
    const amount = toReportNumber(categoryBucket.total || 0, "total_categoria");
    if (Math.abs(amount) < 0.00001) {
      continue;
    }

    if (!bucketsByCurrency.has(currency)) {
      bucketsByCurrency.set(currency, {
        moneda: currency,
        ingresos_total: 0,
        egresos_total: 0,
        resultado_periodo: 0,
        ingresos_por_categoria: new Map(),
        egresos_por_categoria: new Map(),
      });
    }

    const currencyBucket = bucketsByCurrency.get(currency);
    const categoryRecord = categoryLookup.get(Number(categoryBucket.categoria_id)) || null;
    const categoryLabel = normalizeCategoryLabel(categoryRecord, amount);

    currencyBucket.resultado_periodo = Number((currencyBucket.resultado_periodo + amount).toFixed(2));

    if (amount > 0) {
      currencyBucket.ingresos_total = Number((currencyBucket.ingresos_total + amount).toFixed(2));
      const current = currencyBucket.ingresos_por_categoria.get(categoryLabel) || 0;
      currencyBucket.ingresos_por_categoria.set(
        categoryLabel,
        Number((current + amount).toFixed(2)),
      );
      continue;
    }

    const positiveAmount = Math.abs(amount);
    currencyBucket.egresos_total = Number((currencyBucket.egresos_total + positiveAmount).toFixed(2));
    const current = currencyBucket.egresos_por_categoria.get(categoryLabel) || 0;
    currencyBucket.egresos_por_categoria.set(
      categoryLabel,
      Number((current + positiveAmount).toFixed(2)),
    );
  }

  return {
    periodo: {
      anio: period.year,
      mes: period.month,
      fecha_desde: period.fecha_desde,
      fecha_hasta: period.fecha_hasta,
    },
    monedas: Array.from(bucketsByCurrency.values())
      .map((bucket) => ({
        moneda: bucket.moneda,
        ingresos_total: bucket.ingresos_total,
        egresos_total: bucket.egresos_total,
        resultado_periodo: bucket.resultado_periodo,
        ingresos_por_categoria: sortCategoryRows(
          Array.from(bucket.ingresos_por_categoria.entries()).map(([categoria, monto]) => ({
            categoria,
            monto,
          })),
        ),
        egresos_por_categoria: sortCategoryRows(
          Array.from(bucket.egresos_por_categoria.entries()).map(([categoria, monto]) => ({
            categoria,
            monto,
          })),
        ),
      }))
      .sort((left, right) => String(left.moneda).localeCompare(String(right.moneda), "es")),
  };
}

function serializeAdminListItem(report) {
  return {
    id: Number(report.id || 0),
    year: Number(report.year || 0),
    month: Number(report.month || 0),
    version: Number(report.version || 0),
    status: report.status,
    generated_at: report.generated_at || null,
    published_at: report.published_at || null,
    archived_at: report.archived_at || null,
    currencies: Array.isArray(report.snapshot?.monedas)
      ? report.snapshot.monedas.map((item) => item.moneda).filter(Boolean)
      : [],
  };
}

function serializeAdminDetail(report) {
  return {
    ...serializeAdminListItem(report),
    snapshot: report.snapshot,
    created_at: report.createdAt || null,
    updated_at: report.updatedAt || null,
  };
}

function serializePublicListItem(report) {
  return {
    id: Number(report.id || 0),
    year: Number(report.year || 0),
    month: Number(report.month || 0),
    published_at: report.published_at || null,
    currencies: Array.isArray(report.snapshot?.monedas)
      ? report.snapshot.monedas.map((item) => item.moneda).filter(Boolean)
      : [],
  };
}

function serializePublicDetail(report) {
  return {
    ...serializePublicListItem(report),
    snapshot: report.snapshot,
  };
}

export function buildPublicMonthlyAccountingPdfFilename(report) {
  return sanitizeFilenameSegment(
    `informe-financiero-${report.year}-${String(report.month).padStart(2, "0")}-v${report.version}.pdf`,
  );
}

export function buildPublicMonthlyAccountingPdfObjectKey(report) {
  const filename = buildPublicMonthlyAccountingPdfFilename(report);
  return `accounting/public-monthly/${report.year}/${String(report.month).padStart(2, "0")}/v${report.version}/${filename}`;
}

async function loadCategoryLookup(summary = {}, dependencies = {}) {
  const categoryIds = Array.isArray(summary?.categorias)
    ? summary.categorias
      .map((item) => toPositiveInteger(item.categoria_id))
      .filter(Boolean)
    : [];

  if (!categoryIds.length) {
    return new Map();
  }

  const categoryRepository = dependencies.categoryRepository
    || AppDataSource.getRepository(TransactionCategory);
  const categories = await categoryRepository.find({
    where: {
      categoria_transaccion_id: In(categoryIds),
    },
    relations: {
      categoria_padre: true,
    },
  });

  return new Map(
    categories.map((category) => [Number(category.categoria_transaccion_id), category]),
  );
}

async function loadReportOrThrow(repository, reportId) {
  const report = await repository.findOne({
    where: { id: Number(reportId) },
  });

  if (!report) {
    throw buildServiceError("Informe publico contable no encontrado.", 404);
  }

  return report;
}

async function loadPublicPublishedReportOrThrow(repository, reportId) {
  const report = await repository.findOne({
    where: {
      id: Number(reportId),
      status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
    },
  });

  if (!report) {
    throw buildServiceError("Informe publico contable no encontrado.", 404);
  }

  return report;
}

async function resolveNextVersion(repository, year, month) {
  const latest = await repository.findOne({
    where: { year: Number(year), month: Number(month) },
    order: { version: "DESC" },
  });

  return Number(latest?.version || 0) + 1;
}

async function buildMonthlySnapshotPayload(body = {}, authContext = {}, dependencies = {}) {
  const year = Number(body.year);
  const month = Number(body.month);
  const period = buildMonthBounds(year, month);

  if (isFutureMonthlyPeriod(year, month, dependencies.now || new Date())) {
    throw buildServiceError("No se puede generar un informe publico para un periodo futuro.", 400);
  }

  const reportDatasetBuilder = dependencies.reportDatasetBuilder || buildAccountingTransactionsReportDataset;
  const dataset = await reportDatasetBuilder(
    {
      fecha_desde: period.fecha_desde,
      fecha_hasta: period.fecha_hasta,
    },
    authContext,
    dependencies.reportDependencies || {},
    { paginate: false },
  );
  const categoryLookup = await loadCategoryLookup(dataset.summary, dependencies);
  const snapshot = buildPublicMonthlyAccountingSnapshot(dataset.summary, categoryLookup, period);

  return {
    year,
    month,
    period,
    snapshot,
  };
}

export async function generatePublicMonthlyAccountingReportService(
  body = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const payload = await buildMonthlySnapshotPayload(body, authContext, dependencies);
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const version = await resolveNextVersion(repository, payload.year, payload.month);

    const report = await repository.save(
      repository.create({
        year: payload.year,
        month: payload.month,
        version,
        status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT,
        snapshot: payload.snapshot,
        generated_at: new Date(),
        generated_by: { id_usuario: Number(authContext.userId) },
      }),
    );

    return [serializeAdminDetail(report), null];
  } catch (error) {
    console.error("Error al generar informe publico contable mensual:", error);
    return [null, error.message || "Error interno al generar el informe publico contable."];
  }
}

export async function listPublicMonthlyAccountingReportsService(
  query = {},
  _authContext = {},
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const pagination = buildPagination(query);
    const where = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.year) {
      where.year = Number(query.year);
    }
    if (query.month) {
      where.month = Number(query.month);
    }

    const [items, total] = await repository.findAndCount({
      where,
      order: {
        year: "DESC",
        month: "DESC",
        version: "DESC",
        id: "DESC",
      },
      skip: pagination.skip,
      take: pagination.limit,
    });

    return [buildPagedResult(items.map(serializeAdminListItem), total, pagination.page, pagination.limit), null];
  } catch (error) {
    console.error("Error al listar informes publicos contables:", error);
    return [null, error.message || "Error interno al listar informes publicos contables."];
  }
}

export async function getPublicMonthlyAccountingReportByIdService(
  reportId,
  _authContext = {},
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const report = await loadReportOrThrow(repository, reportId);
    return [serializeAdminDetail(report), null];
  } catch (error) {
    console.error("Error al obtener informe publico contable:", error);
    return [null, error.message || "Error interno al obtener el informe publico contable."];
  }
}

export async function publishPublicMonthlyAccountingReportService(
  reportId,
  authContext = {},
  dependencies = {},
) {
  const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
  const uploadBufferService = dependencies.uploadBufferService || uploadBuffer;
  const removeObjectService = dependencies.removeObjectService || removeObject;
  const pdfGenerator = dependencies.pdfGenerator || generatePublicMonthlyAccountingReportPdfBuffer;
  let uploadedObjectKey = null;

  try {
    const report = await loadReportOrThrow(repository, reportId);

    if (report.status !== PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT) {
      throw buildServiceError("Solo se puede publicar un informe en estado BORRADOR.", 400);
    }

    if (!report.snapshot?.periodo || !Array.isArray(report.snapshot?.monedas)) {
      throw buildServiceError("El informe no tiene un snapshot valido para publicar.", 400);
    }

    const publishedAt = new Date();
    const objectKey = buildPublicMonthlyAccountingPdfObjectKey(report);
    const filename = buildPublicMonthlyAccountingPdfFilename(report);
    const pdfBuffer = await pdfGenerator({
      report,
      publishedAt,
    });

    await uploadBufferService({
      bucketName: MINIO_BUCKETS.private,
      objectKey,
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      mimeType: PUBLIC_REPORT_PDF_CONTENT_TYPE,
      metadata: {
        reportYear: String(report.year),
        reportMonth: String(report.month),
        reportVersion: String(report.version),
      },
    });
    uploadedObjectKey = objectKey;

    const result = await AppDataSource.transaction(async (manager) => {
      const transactionalRepository = manager.getRepository(PublicMonthlyAccountingReport);
      const current = await transactionalRepository.findOne({
        where: { id: Number(report.id) },
      });

      if (!current) {
        throw buildServiceError("Informe publico contable no encontrado.", 404);
      }

      if (current.status !== PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.DRAFT) {
        throw buildServiceError("Solo se puede publicar un informe en estado BORRADOR.", 400);
      }

      const previousPublished = await transactionalRepository.findOne({
        where: {
          year: Number(current.year),
          month: Number(current.month),
          status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
        },
        order: { version: "DESC" },
      });

      if (previousPublished && Number(previousPublished.id) !== Number(current.id)) {
        previousPublished.status = PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED;
        previousPublished.archived_at = publishedAt;
        await transactionalRepository.save(previousPublished);
      }

      current.status = PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED;
      current.pdf_object_key = objectKey;
      current.published_at = publishedAt;
      current.archived_at = null;
      current.published_by = { id_usuario: Number(authContext.userId) };
      await transactionalRepository.save(current);

      return current;
    });

    return [
      {
        ...serializeAdminDetail(result),
        download_filename: filename,
      },
      null,
    ];
  } catch (error) {
    if (uploadedObjectKey) {
      try {
        await removeObjectService({
          bucketName: MINIO_BUCKETS.private,
          objectKey: uploadedObjectKey,
        });
      } catch (cleanupError) {
        console.error("No fue posible limpiar PDF de informe publico tras fallo de publicacion:", cleanupError);
      }
    }

    console.error("Error al publicar informe publico contable:", error);
    return [null, error.message || "Error interno al publicar el informe publico contable."];
  }
}

export async function archivePublicMonthlyAccountingReportService(
  reportId,
  _authContext = {},
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const report = await loadReportOrThrow(repository, reportId);

    if (report.status === PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED) {
      throw buildServiceError("El informe ya se encuentra archivado.", 400);
    }

    report.status = PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.ARCHIVED;
    report.archived_at = new Date();
    await repository.save(report);

    return [serializeAdminDetail(report), null];
  } catch (error) {
    console.error("Error al archivar informe publico contable:", error);
    return [null, error.message || "Error interno al archivar el informe publico contable."];
  }
}

async function buildDownloadPayload(report, dependencies = {}) {
  if (!report.pdf_object_key) {
    throw buildServiceError("El informe solicitado aun no tiene un PDF disponible.", 400);
  }

  const getObjectStreamService = dependencies.getObjectStreamService || getObjectStream;
  const filename = buildPublicMonthlyAccountingPdfFilename(report);
  const stream = await getObjectStreamService({
    bucketName: MINIO_BUCKETS.private,
    objectKey: report.pdf_object_key,
  });

  return {
    stream,
    contentType: PUBLIC_REPORT_PDF_CONTENT_TYPE,
    contentDisposition: `attachment; filename="${filename}"`,
  };
}

export async function downloadPublicMonthlyAccountingReportService(
  reportId,
  _authContext = {},
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const report = await loadReportOrThrow(repository, reportId);
    return [await buildDownloadPayload(report, dependencies), null];
  } catch (error) {
    console.error("Error al descargar informe publico contable:", error);
    return [null, error.message || "Error interno al descargar el informe publico contable."];
  }
}

export async function listPublishedPublicMonthlyAccountingReportsService(
  query = {},
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const pagination = buildPagination(query);
    const [items, total] = await repository.findAndCount({
      where: {
        status: PUBLIC_MONTHLY_ACCOUNTING_REPORT_STATUS.PUBLISHED,
      },
      order: {
        year: "DESC",
        month: "DESC",
        version: "DESC",
        published_at: "DESC",
        id: "DESC",
      },
      skip: pagination.skip,
      take: pagination.limit,
    });

    return [buildPagedResult(items.map(serializePublicListItem), total, pagination.page, pagination.limit), null];
  } catch (error) {
    console.error("Error al listar informes publicos contables publicados:", error);
    return [null, error.message || "Error interno al listar los informes publicos contables."];
  }
}

export async function getPublishedPublicMonthlyAccountingReportByIdService(
  reportId,
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const report = await loadPublicPublishedReportOrThrow(repository, reportId);
    return [serializePublicDetail(report), null];
  } catch (error) {
    console.error("Error al obtener informe publico contable publicado:", error);
    return [null, error.message || "Error interno al obtener el informe publico contable."];
  }
}

export async function downloadPublishedPublicMonthlyAccountingReportService(
  reportId,
  dependencies = {},
) {
  try {
    const repository = dependencies.repository || AppDataSource.getRepository(PublicMonthlyAccountingReport);
    const report = await loadPublicPublishedReportOrThrow(repository, reportId);
    return [await buildDownloadPayload(report, dependencies), null];
  } catch (error) {
    console.error("Error al descargar informe publico contable publicado:", error);
    return [null, error.message || "Error interno al descargar el informe publico contable."];
  }
}

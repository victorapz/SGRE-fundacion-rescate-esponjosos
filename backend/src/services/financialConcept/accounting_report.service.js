"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  PaymentProvider,
  Transaction,
  TransactionCategory,
  normalizeNullableString,
} from "./accounting.shared.js";
import {
  REPORT_FIELD_TYPES,
  REPORT_TYPES,
} from "../reporting/report.constants.js";
import {
  accumulateCurrencyTotals,
  buildChileReportDateRange,
  buildReportPaginationMeta,
  buildReportPreviewResponse,
  normalizeReportPagination,
  toReportNumber,
} from "../reporting/report.shared.js";
import {
  buildDisplayFilterEntry,
  formatAccountingExportLabel,
} from "../reporting/export/report_accounting.presentation.js";
import { formatExportDate } from "../reporting/export/report_export.shared.js";

export const ACCOUNTING_REPORT_TRANSACTION_TYPES = [
  "INGRESO",
  "EGRESO",
  "REEMBOLSO",
  "AJUSTE",
];

export const ACCOUNTING_REPORT_TRANSACTION_STATES = [
  "CONFIRMADA",
  "ANULADA",
  "REEMBOLSADA",
  "PARCIALMENTE_REEMBOLSADA",
  "COMPLETADA",
  "CANCELADA",
  "FALLIDA",
  "PENDIENTE",
];

export const ACCOUNTING_REPORT_DEFAULT_INCLUDED_STATES = [
  "CONFIRMADA",
  "COMPLETADA",
];

const DONATION_REFUND_CATEGORY_KEY = "DEVOLUCION_DONACION";
const DONATION_REVERSAL_CATEGORY_KEY = "REVERSA_PAYPAL";

function normalizeReportCode(value) {
  return normalizeNullableString(value)?.toUpperCase() || null;
}

function normalizeTransactionStateForReport(state) {
  const normalized = normalizeReportCode(state);
  return normalized && ACCOUNTING_REPORT_TRANSACTION_STATES.includes(normalized)
    ? normalized
    : null;
}

function normalizeTransactionTypeForReport(type) {
  const normalized = normalizeReportCode(type);
  return normalized && ACCOUNTING_REPORT_TRANSACTION_TYPES.includes(normalized)
    ? normalized
    : null;
}

function cloneReportMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return { ...metadata };
}

export function classifyAccountingTransaction(transaction) {
  const metadata = cloneReportMetadata(transaction?.metadata);
  const adjustmentType = normalizeReportCode(metadata?.adjustment_type);
  const categoryKey = normalizeReportCode(transaction?.category?.clave);
  const originType = normalizeReportCode(transaction?.origen_tipo);
  const transactionType = normalizeTransactionTypeForReport(transaction?.tipo);
  const feeAmount = toReportNumber(transaction?.monto_fee, "monto_fee");

  if (
    ["EGRESO", "REEMBOLSO", "AJUSTE"].includes(transactionType)
    && (
      adjustmentType === "REVERSAL"
      || categoryKey === DONATION_REVERSAL_CATEGORY_KEY
      || originType === "PAYPAL_DONATION_REVERSAL"
    )
  ) {
    return "REVERSAL";
  }

  if (
    ["EGRESO", "REEMBOLSO", "AJUSTE"].includes(transactionType)
    && (
      adjustmentType === "REFUND"
      || categoryKey === DONATION_REFUND_CATEGORY_KEY
      || originType === "PAYPAL_DONATION_REFUND"
    )
  ) {
    return "REFUND";
  }

  if (feeAmount > 0) {
    return "FEE";
  }

  return "NORMAL";
}

export function resolveAccountingTransactionOrigin(transaction) {
  const directOrigin = normalizeReportCode(transaction?.origen_tipo);
  if (directOrigin) return directOrigin;

  const payableOrigin = normalizeReportCode(transaction?.payable_account?.origen_tipo);
  if (payableOrigin) return payableOrigin;

  return null;
}

export function resolveAccountingTransactionDirection(transaction) {
  const transactionType = normalizeTransactionTypeForReport(transaction?.tipo);

  if (transactionType === "INGRESO") return 1;
  if (transactionType === "EGRESO" || transactionType === "REEMBOLSO") return -1;

  if (transactionType === "AJUSTE") {
    const categoryType = normalizeReportCode(transaction?.category?.tipo);

    if (categoryType === "INGRESO") return 1;
    if (categoryType === "EGRESO") return -1;
    return null;
  }

  return null;
}

function buildAmountBundle(transaction) {
  return {
    bruto: toReportNumber(transaction?.monto_bruto, "monto_bruto"),
    fee: toReportNumber(transaction?.monto_fee, "monto_fee"),
    neto: toReportNumber(transaction?.monto_neto, "monto_neto"),
  };
}

export function buildAccountingTransactionRow(transaction) {
  const amounts = buildAmountBundle(transaction);

  return {
    id: Number(transaction?.transaccion_id || 0),
    fecha: transaction?.fecha_transaccion
      ? new Date(transaction.fecha_transaccion).toISOString()
      : null,
    tipo: normalizeTransactionTypeForReport(transaction?.tipo),
    estado: normalizeTransactionStateForReport(transaction?.estado),
    clasificacion: classifyAccountingTransaction(transaction),
    categoria: transaction?.category
      ? {
          id: Number(transaction.category.categoria_transaccion_id || 0),
          clave: transaction.category.clave || "",
          nombre: transaction.category.nombre || "",
          tipo: transaction.category.tipo || "",
        }
      : null,
    descripcion: transaction?.descripcion || null,
    monto_bruto: amounts.bruto,
    monto_fee: amounts.fee,
    monto_neto: amounts.neto,
    moneda: normalizeReportCode(transaction?.moneda) || "CLP",
    proveedor_pago: transaction?.payment_provider
      ? {
          id: Number(transaction.payment_provider.proveedor_pago_id || 0),
          clave: transaction.payment_provider.clave || "",
          nombre: transaction.payment_provider.nombre || "",
          tipo: transaction.payment_provider.tipo || "",
        }
      : null,
    referencia_externa: transaction?.referencia_externa || null,
    origen: resolveAccountingTransactionOrigin(transaction),
  };
}

export function summarizeAccountingTransactions(transactions = []) {
  const summary = {
    monedas: {},
    operaciones_totales: 0,
    categorias: [],
    tipos: [],
    estados_incluidos: [],
  };
  const categoryBuckets = new Map();
  const seenTypes = new Set();
  const seenStates = new Set();
  const warnings = new Set();

  for (const transaction of transactions) {
    const row = buildAccountingTransactionRow(transaction);
    const currency = row.moneda || "CLP";
    const direction = resolveAccountingTransactionDirection(transaction);
    const classification = row.clasificacion;
    const amounts = buildAmountBundle(transaction);

    if (direction === null) {
      warnings.add(
        `La transaccion ${row.id} no pudo determinar su impacto contable con tipo/categoria reales.`,
      );
    }

    if (!row.categoria) {
      warnings.add("Existen operaciones sin categoria contable asociada.");
    }

    if (!row.origen) {
      warnings.add("Existen operaciones cuyo origen no pudo determinarse de forma fiable.");
    }

    if (classification === "REVERSAL" && row.tipo !== "EGRESO" && row.tipo !== "REEMBOLSO") {
      warnings.add(
        `La transaccion ${row.id} fue clasificada como reversal fuera del patron de egreso esperado.`,
      );
    }

    summary.operaciones_totales += 1;
    seenTypes.add(row.tipo || "DESCONOCIDO");
    if (row.estado) {
      seenStates.add(row.estado);
    }

    accumulateCurrencyTotals(summary.monedas, currency, {
      ingresos_brutos: direction === 1 ? amounts.bruto : 0,
      egresos_brutos: direction === -1 ? amounts.bruto : 0,
      fees: amounts.fee,
      refunds: classification === "REFUND" ? amounts.bruto : 0,
      reversals: classification === "REVERSAL" ? amounts.bruto : 0,
      resultado_neto: direction === null ? 0 : amounts.neto * direction,
      operaciones: 1,
    });

    const categoryKey = [
      row.categoria?.id || "SIN_CATEGORIA",
      currency,
      row.tipo || "DESCONOCIDO",
    ].join(":");
    const existingCategory = categoryBuckets.get(categoryKey) || {
      categoria_id: row.categoria?.id || null,
      categoria_nombre: row.categoria?.nombre || "Sin categoria",
      moneda: currency,
      tipo: row.tipo || "DESCONOCIDO",
      total: 0,
      operaciones: 0,
    };

    const signedTotal = direction === null ? 0 : amounts.neto * direction;
    existingCategory.total = Number((existingCategory.total + signedTotal).toFixed(2));
    existingCategory.operaciones += 1;
    categoryBuckets.set(categoryKey, existingCategory);
  }

  const currencies = Object.keys(summary.monedas);
  if (currencies.length > 1) {
    warnings.add("El resultado contiene multiples monedas y se presenta agrupado por moneda.");
  }

  summary.categorias = Array.from(categoryBuckets.values()).sort((left, right) => {
    if (left.moneda !== right.moneda) {
      return left.moneda.localeCompare(right.moneda, "es");
    }

    if (left.tipo !== right.tipo) {
      return left.tipo.localeCompare(right.tipo, "es");
    }

    return left.categoria_nombre.localeCompare(right.categoria_nombre, "es");
  });
  summary.tipos = Array.from(seenTypes).sort((left, right) => left.localeCompare(right, "es"));
  summary.estados_incluidos = Array.from(seenStates).sort((left, right) =>
    left.localeCompare(right, "es"));

  return {
    summary,
    warnings: Array.from(warnings),
  };
}

function buildBaseTransactionsReportQuery(repository) {
  return repository
    .createQueryBuilder("transaction")
    .leftJoinAndSelect("transaction.category", "category")
    .leftJoinAndSelect("transaction.payment_provider", "paymentProvider")
    .leftJoinAndSelect("transaction.payment_order", "paymentOrder")
    .leftJoinAndSelect("transaction.payable_account", "payableAccount");
}

function applyAccountingTransactionsReportFilters(queryBuilder, filters = {}) {
  const {
    tipo,
    estado,
    categoria_id,
    proveedor_pago_id,
    moneda,
    origin,
    search,
    dateRange,
  } = filters;

  if (dateRange?.fromInclusive) {
    queryBuilder.andWhere("transaction.fecha_transaccion >= :fechaDesde", {
      fechaDesde: dateRange.fromInclusive,
    });
  }

  if (dateRange?.toExclusive) {
    queryBuilder.andWhere("transaction.fecha_transaccion < :fechaHastaExclusiva", {
      fechaHastaExclusiva: dateRange.toExclusive,
    });
  }

  if (tipo) {
    queryBuilder.andWhere("transaction.tipo = :tipo", { tipo });
  }

  if (estado) {
    queryBuilder.andWhere("transaction.estado = :estado", { estado });
  } else {
    queryBuilder.andWhere("transaction.estado IN (:...includedStates)", {
      includedStates: ACCOUNTING_REPORT_DEFAULT_INCLUDED_STATES,
    });
  }

  if (categoria_id) {
    queryBuilder.andWhere("category.categoria_transaccion_id = :categoriaId", {
      categoriaId: Number(categoria_id),
    });
  }

  if (proveedor_pago_id) {
    queryBuilder.andWhere("paymentProvider.proveedor_pago_id = :providerId", {
      providerId: Number(proveedor_pago_id),
    });
  }

  if (moneda) {
    queryBuilder.andWhere("transaction.moneda = :moneda", { moneda });
  }

  if (origin) {
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("UPPER(transaction.origen_tipo) = :origin", { origin })
          .orWhere("UPPER(payableAccount.origen_tipo) = :origin", { origin });
      }),
    );
  }

  if (search) {
    const searchPattern = `%${String(search).trim()}%`;
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("transaction.descripcion ILIKE :search", { search: searchPattern })
          .orWhere("transaction.referencia_externa ILIKE :search", { search: searchPattern })
          .orWhere("transaction.idempotencia_key ILIKE :search", { search: searchPattern })
          .orWhere("category.nombre ILIKE :search", { search: searchPattern })
          .orWhere("category.clave ILIKE :search", { search: searchPattern })
          .orWhere("paymentProvider.nombre ILIKE :search", { search: searchPattern })
          .orWhere('CAST(transaction.transaccion_id AS TEXT) ILIKE :search', {
            search: searchPattern,
          });
      }),
    );
  }

  return queryBuilder;
}

function buildFiltersSnapshot(filters, dateRange, page, limit) {
  return {
    fecha_desde: dateRange.normalized.fecha_desde,
    fecha_hasta: dateRange.normalized.fecha_hasta,
    time_zone: dateRange.normalized.time_zone,
    tipo: filters.tipo || null,
    estado: filters.estado || null,
    categoria_id: filters.categoria_id ? Number(filters.categoria_id) : null,
    proveedor_pago_id: filters.proveedor_pago_id ? Number(filters.proveedor_pago_id) : null,
    moneda: filters.moneda || null,
    origin: filters.origin || null,
    search: normalizeNullableString(filters.search),
    page,
    limit,
    estados_por_defecto: filters.estado ? [] : [...ACCOUNTING_REPORT_DEFAULT_INCLUDED_STATES],
  };
}

async function buildAccountingTransactionsDisplayFilters(filters = {}, dependencies = {}) {
  const entries = [
    buildDisplayFilterEntry("Fecha desde", filters.fecha_desde ? formatExportDate(filters.fecha_desde) : null),
    buildDisplayFilterEntry("Fecha hasta", filters.fecha_hasta ? formatExportDate(filters.fecha_hasta) : null),
    buildDisplayFilterEntry("Tipo de movimiento", filters.tipo ? formatAccountingExportLabel(filters.tipo) : null),
    buildDisplayFilterEntry(
      "Estado",
      filters.estado
        ? formatAccountingExportLabel(filters.estado)
        : filters.estados_por_defecto?.length
          ? filters.estados_por_defecto.map(formatAccountingExportLabel)
          : null,
    ),
  ];

  if (filters.categoria_id) {
    const categoryRepository = dependencies.categoryRepository
      || AppDataSource.getRepository(TransactionCategory);
    const category = await categoryRepository.findOne({
      where: { categoria_transaccion_id: Number(filters.categoria_id) },
    });
    entries.push(
      buildDisplayFilterEntry(
        "Categoria",
        category?.nombre || category?.clave || "Registro no disponible",
      ),
    );
  }

  if (filters.proveedor_pago_id) {
    const providerRepository = dependencies.paymentProviderRepository
      || AppDataSource.getRepository(PaymentProvider);
    const provider = await providerRepository.findOne({
      where: { proveedor_pago_id: Number(filters.proveedor_pago_id) },
    });
    entries.push(
      buildDisplayFilterEntry(
        "Proveedor de pago",
        provider?.nombre || provider?.clave || "Registro no disponible",
      ),
    );
  }

  entries.push(
    buildDisplayFilterEntry("Moneda", filters.moneda || null),
    buildDisplayFilterEntry("Origen", filters.origin ? formatAccountingExportLabel(filters.origin) : null),
    buildDisplayFilterEntry("Buscar", filters.search || null),
  );

  return entries.filter(Boolean);
}

async function buildAccountingTransactionsReportDataset(
  query = {},
  authContext = {},
  dependencies = {},
  options = {},
) {
  const repository = dependencies.repository || AppDataSource.getRepository(Transaction);
  const pagination = options.paginate !== false
    ? normalizeReportPagination(query)
    : { page: null, limit: null, skip: 0 };
  const normalizedFilters = {
    tipo: normalizeTransactionTypeForReport(query.tipo),
    estado: normalizeTransactionStateForReport(query.estado),
    categoria_id: query.categoria_id ? Number(query.categoria_id) : null,
    proveedor_pago_id: query.proveedor_pago_id ? Number(query.proveedor_pago_id) : null,
    moneda: normalizeReportCode(query.moneda),
    origin: normalizeReportCode(query.origin),
    search: normalizeNullableString(query.search),
  };
  const dateRange = buildChileReportDateRange({
    fecha_desde: query.fecha_desde,
    fecha_hasta: query.fecha_hasta,
    fieldType: REPORT_FIELD_TYPES.TIMESTAMP,
    now: dependencies.now || new Date(),
  });

  const filteredQuery = applyAccountingTransactionsReportFilters(
    buildBaseTransactionsReportQuery(repository),
    {
      ...normalizedFilters,
      dateRange,
    },
  );

  const orderedQuery = filteredQuery
    .clone()
    .orderBy("transaction.fecha_transaccion", "DESC")
    .addOrderBy("transaction.transaccion_id", "DESC");
  const allTransactions = await orderedQuery.getMany();
  const allRows = allTransactions.map(buildAccountingTransactionRow);
  const { summary, warnings } = summarizeAccountingTransactions(allTransactions);
  const pagedRows = options.paginate === false
    ? allRows
    : allRows.slice(pagination.skip, pagination.skip + pagination.limit);

  return {
    report_type: REPORT_TYPES.ACCOUNTING_TRANSACTIONS,
    generated_by: authContext.user || null,
    filters: buildFiltersSnapshot(
      normalizedFilters,
      dateRange,
      pagination.page,
      pagination.limit,
    ),
    summary,
    warnings,
    total_rows: allRows.length,
    rows: pagedRows,
    all_rows: allRows,
    pagination: options.paginate === false
      ? null
      : buildReportPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: allRows.length,
        }),
  };
}

export async function getAccountingTransactionsReportPreviewService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildAccountingTransactionsReportDataset(
      query,
      authContext,
      dependencies,
      { paginate: true },
    );

    return [
      buildReportPreviewResponse({
        reportType: REPORT_TYPES.ACCOUNTING_TRANSACTIONS,
        generatedBy: authContext.user || null,
        filters: dataset.filters,
        summary: dataset.summary,
        rows: dataset.rows,
        pagination: dataset.pagination,
        warnings: dataset.warnings,
      }),
      null,
    ];
  } catch (error) {
    console.error("Error al generar preview del informe contable:", error);
    return [null, error.message || "Error interno al generar el informe contable"];
  }
}

export async function getAccountingTransactionsReportExportService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildAccountingTransactionsReportDataset(
      query,
      authContext,
      dependencies,
      { paginate: false },
    );

    return [
      {
        report_type: dataset.report_type,
        generated_by: authContext.user || null,
        filters: {
          ...dataset.filters,
          display_filters: await buildAccountingTransactionsDisplayFilters(
            dataset.filters,
            dependencies,
          ),
        },
        summary: dataset.summary,
        warnings: dataset.warnings,
        rows: dataset.all_rows,
        total_rows: dataset.total_rows,
      },
      null,
    ];
  } catch (error) {
    console.error("Error al generar dataset de exportacion del informe contable:", error);
    return [null, error.message || "Error interno al generar el informe contable"];
  }
}

export {
  applyAccountingTransactionsReportFilters,
  buildBaseTransactionsReportQuery,
  buildAccountingTransactionsReportDataset,
};

"use strict";

import { Brackets, ILike } from "typeorm";
import Supplier from "../../entities/inventoryConcept/supplier.entity.js";
import VetClinic from "../../entities/animalConcept/vet_clinic.entity.js";
import TransactionCategory from "../../entities/financialConcept/transaction_category.entity.js";
import {
  AppDataSource,
  PayableAccount,
  PayablePayment,
  normalizeNullableString,
} from "./accounting.shared.js";
import {
  REPORT_FIELD_TYPES,
  REPORT_TYPES,
} from "../reporting/report.constants.js";
import {
  buildChileReportDateRange,
  buildReportPaginationMeta,
  buildReportPreviewResponse,
  getCurrentChileDateTime,
  normalizeReportPagination,
  toReportNumber,
} from "../reporting/report.shared.js";
import {
  buildDisplayFilterEntry,
  formatAccountingExportLabel,
} from "../reporting/export/report_accounting.presentation.js";
import { formatExportDate } from "../reporting/export/report_export.shared.js";

export const PAYABLE_REPORT_STATES = [
  "PENDIENTE",
  "PAGADA_PARCIAL",
  "PAGADA",
  "VENCIDA",
  "ANULADA",
  "CONDONADA",
];

function normalizeReportCode(value) {
  return normalizeNullableString(value)?.toUpperCase() || null;
}

export function derivePayableReportState(payable, chileDate) {
  const persistedState = normalizeReportCode(payable?.estado);
  const total = toReportNumber(payable?.monto_total, "monto_total");
  const paid = toReportNumber(payable?.monto_pagado, "monto_pagado");
  const balance = Math.max(
    0,
    Number((toReportNumber(payable?.saldo_pendiente, "saldo_pendiente")).toFixed(2)),
  );
  const dueDate = payable?.fecha_vencimiento || null;

  if (persistedState === "ANULADA" || persistedState === "CONDONADA") {
    return persistedState;
  }

  if (balance <= 0 || total <= 0) {
    return "PAGADA";
  }

  if (paid > 0 && balance > 0) {
    return "PAGADA_PARCIAL";
  }

  if (dueDate && String(dueDate) < String(chileDate)) {
    return "VENCIDA";
  }

  return "PENDIENTE";
}

export function isPayableOverdue(payable, chileDate) {
  return derivePayableReportState(payable, chileDate) === "VENCIDA";
}

export function resolvePayableCounterparty(payable, lookups = {}) {
  const providerType = normalizeReportCode(payable?.proveedor_tipo);
  const providerId = payable?.proveedor_id ? Number(payable.proveedor_id) : null;

  if (!providerType || !providerId) {
    return null;
  }

  if (providerType === "SUPPLIER") {
    const supplier = lookups.suppliersById?.get(providerId) || null;
    return {
      tipo: "SUPPLIER",
      id: providerId,
      nombre: supplier?.nombre || null,
    };
  }

  if (providerType === "VET_CLINIC") {
    const clinic = lookups.clinicsById?.get(providerId) || null;
    return {
      tipo: "VET_CLINIC",
      id: providerId,
      nombre: clinic?.nombre || null,
    };
  }

  return {
    tipo: providerType,
    id: providerId,
    nombre: null,
  };
}

export function resolvePayableOrigin(payable) {
  const originType = normalizeReportCode(payable?.origen_tipo);
  const originId = payable?.origen_id ? Number(payable.origen_id) : null;

  if (!originType) {
    return null;
  }

  const labels = {
    PURCHASE: "Compra",
    EXAM: "Examen",
    HOSPITALIZATION: "Hospitalizacion",
    PROCEDURE: "Procedimiento",
    VET_CHECKUP: "Control veterinario",
  };

  return {
    tipo: originType,
    id_visible: originId ? String(originId) : null,
    descripcion: originId
      ? `${labels[originType] || originType} #${originId}`
      : payable?.descripcion || labels[originType] || originType,
  };
}

export function buildPayableReportRow(payable, options = {}) {
  const chileDate = options.chileDate;
  const paymentAggregate = options.paymentAggregatesById?.get(Number(payable.cuenta_por_pagar_id))
    || null;
  const counterparty = resolvePayableCounterparty(payable, options);
  const origin = resolvePayableOrigin(payable);
  const derivedState = derivePayableReportState(payable, chileDate);

  return {
    id: Number(payable.cuenta_por_pagar_id || 0),
    fecha: payable?.fecha_emision || null,
    fecha_vencimiento: payable?.fecha_vencimiento || null,
    concepto: payable?.category?.nombre || null,
    descripcion: payable?.descripcion || null,
    estado: derivedState,
    moneda: normalizeReportCode(payable?.moneda) || "CLP",
    monto_original: toReportNumber(payable?.monto_total, "monto_total"),
    monto_pagado: toReportNumber(payable?.monto_pagado, "monto_pagado"),
    saldo_pendiente: Math.max(
      0,
      toReportNumber(payable?.saldo_pendiente, "saldo_pendiente"),
    ),
    categoria: payable?.category
      ? {
          id: Number(payable.category.categoria_transaccion_id || 0),
          clave: payable.category.clave || "",
          nombre: payable.category.nombre || "",
        }
      : null,
    contraparte: counterparty,
    origen: origin,
    pagos: {
      cantidad: Number(paymentAggregate?.cantidad_pagos || 0),
      ultima_fecha_pago: paymentAggregate?.ultima_fecha_pago || null,
      monto_pagado_acumulado: paymentAggregate
        ? toReportNumber(paymentAggregate.monto_pagado_calculado, "monto_pagado_calculado")
        : toReportNumber(payable?.monto_pagado, "monto_pagado"),
    },
  };
}

export function summarizePayables(payables = [], options = {}) {
  const chileDate = options.chileDate;
  const paymentAggregatesById = options.paymentAggregatesById || new Map();
  const suppliersById = options.suppliersById || new Map();
  const clinicsById = options.clinicsById || new Map();
  const summary = {
    monedas: {},
    cuentas_totales: 0,
    origenes: [],
    estados_incluidos: [],
  };
  const warnings = new Set();
  const originBuckets = new Map();
  const seenStates = new Set();

  for (const payable of payables) {
    const row = buildPayableReportRow(payable, {
      chileDate,
      paymentAggregatesById,
      suppliersById,
      clinicsById,
    });
    const currency = row.moneda || "CLP";
    const state = row.estado || "DESCONOCIDO";
    const isCancelled = state === "ANULADA" || state === "CONDONADA";
    const isOverdue = state === "VENCIDA";

    summary.cuentas_totales += 1;
    seenStates.add(state);

    if (!summary.monedas[currency]) {
      summary.monedas[currency] = {
        moneda: currency,
        obligaciones_total: 0,
        pagado_total: 0,
        saldo_pendiente: 0,
        saldo_vencido: 0,
        cuentas: 0,
        pendientes: 0,
        parciales: 0,
        pagadas: 0,
        vencidas: 0,
        anuladas: 0,
        condonadas: 0,
      };
    }

    const bucket = summary.monedas[currency];
    bucket.cuentas += 1;

    if (state === "PENDIENTE") bucket.pendientes += 1;
    if (state === "PAGADA_PARCIAL") bucket.parciales += 1;
    if (state === "PAGADA") bucket.pagadas += 1;
    if (state === "VENCIDA") bucket.vencidas += 1;
    if (state === "ANULADA") bucket.anuladas += 1;
    if (state === "CONDONADA") bucket.condonadas += 1;

    if (!isCancelled) {
      bucket.obligaciones_total = Number((bucket.obligaciones_total + row.monto_original).toFixed(2));
      bucket.pagado_total = Number((bucket.pagado_total + row.monto_pagado).toFixed(2));
      bucket.saldo_pendiente = Number((bucket.saldo_pendiente + row.saldo_pendiente).toFixed(2));
    }

    if (isOverdue) {
      bucket.saldo_vencido = Number((bucket.saldo_vencido + row.saldo_pendiente).toFixed(2));
    }

    if (!row.categoria) {
      warnings.add("Existen cuentas por pagar sin categoria contable asociada.");
    }

    if (row.contraparte?.tipo === "SUPPLIER" && !row.contraparte?.nombre) {
      warnings.add("Existen cuentas por pagar con proveedor sin contraparte resoluble.");
    }

    if (row.contraparte?.tipo === "VET_CLINIC" && !row.contraparte?.nombre) {
      warnings.add("Existen cuentas por pagar con clinica sin contraparte resoluble.");
    }

    if (!row.origen?.tipo) {
      warnings.add("Existen cuentas por pagar sin origen identificable.");
    }

    const paymentAggregate = paymentAggregatesById.get(row.id);
    if (paymentAggregate) {
      const calculatedPaid = toReportNumber(
        paymentAggregate.monto_pagado_calculado,
        "monto_pagado_calculado",
      );
      if (Math.abs(calculatedPaid - row.monto_pagado) > 0.01) {
        warnings.add(
          `Existen cuentas por pagar cuyo monto_pagado persistido no coincide con la suma de pagos aplicados.`,
        );
      }
    }

    const originKey = `${row.origen?.tipo || "SIN_ORIGEN"}:${currency}`;
    const existingOrigin = originBuckets.get(originKey) || {
      origen_tipo: row.origen?.tipo || "SIN_ORIGEN",
      moneda: currency,
      cuentas: 0,
      obligaciones_total: 0,
      pagado_total: 0,
      saldo_pendiente: 0,
    };
    existingOrigin.cuentas += 1;

    if (!isCancelled) {
      existingOrigin.obligaciones_total = Number(
        (existingOrigin.obligaciones_total + row.monto_original).toFixed(2),
      );
      existingOrigin.pagado_total = Number(
        (existingOrigin.pagado_total + row.monto_pagado).toFixed(2),
      );
      existingOrigin.saldo_pendiente = Number(
        (existingOrigin.saldo_pendiente + row.saldo_pendiente).toFixed(2),
      );
    }

    originBuckets.set(originKey, existingOrigin);
  }

  if (Object.keys(summary.monedas).length > 1) {
    warnings.add("El resultado contiene multiples monedas y se presenta agrupado por moneda.");
  }

  summary.origenes = Array.from(originBuckets.values()).sort((left, right) =>
    left.origen_tipo === right.origen_tipo
      ? left.moneda.localeCompare(right.moneda, "es")
      : left.origen_tipo.localeCompare(right.origen_tipo, "es"));
  summary.estados_incluidos = Array.from(seenStates).sort((left, right) =>
    left.localeCompare(right, "es"));

  return {
    summary,
    warnings: Array.from(warnings),
  };
}

function buildBasePayablesReportQuery(repository) {
  return repository
    .createQueryBuilder("payable")
    .leftJoinAndSelect("payable.category", "category");
}

async function buildPayableSearchMatches(search, dependencies = {}) {
  const normalizedSearch = normalizeNullableString(search);
  if (!normalizedSearch) {
    return {
      supplierIds: [],
      clinicIds: [],
    };
  }

  if (typeof dependencies.searchMatchesLoader === "function") {
    return dependencies.searchMatchesLoader(normalizedSearch);
  }

  const supplierRepository = dependencies.supplierRepository
    || AppDataSource.getRepository(Supplier);
  const clinicRepository = dependencies.clinicRepository
    || AppDataSource.getRepository(VetClinic);
  const pattern = ILike(`%${normalizedSearch}%`);
  const [suppliers, clinics] = await Promise.all([
    supplierRepository.find({
      select: {
        proveedor_id: true,
      },
      where: { nombre: pattern },
    }),
    clinicRepository.find({
      select: {
        id_clinica: true,
      },
      where: { nombre: pattern },
    }),
  ]);

  return {
    supplierIds: suppliers.map((item) => Number(item.proveedor_id)).filter(Boolean),
    clinicIds: clinics.map((item) => Number(item.id_clinica)).filter(Boolean),
  };
}

function applyPayableDerivedStateFilter(queryBuilder, state, chileDate) {
  if (!state) {
    return queryBuilder;
  }

  if (state === "ANULADA" || state === "CONDONADA") {
    queryBuilder.andWhere("payable.estado = :persistedState", {
      persistedState: state,
    });
    return queryBuilder;
  }

  if (state === "PAGADA") {
    queryBuilder.andWhere("payable.saldo_pendiente = 0");
    queryBuilder.andWhere("payable.estado NOT IN (:...cancelledStates)", {
      cancelledStates: ["ANULADA", "CONDONADA"],
    });
    return queryBuilder;
  }

  if (state === "PAGADA_PARCIAL") {
    queryBuilder.andWhere("payable.monto_pagado > 0");
    queryBuilder.andWhere("payable.saldo_pendiente > 0");
    queryBuilder.andWhere("payable.estado NOT IN (:...cancelledStates)", {
      cancelledStates: ["ANULADA", "CONDONADA"],
    });
    return queryBuilder;
  }

  if (state === "VENCIDA") {
    queryBuilder.andWhere("payable.saldo_pendiente > 0");
    queryBuilder.andWhere("payable.estado NOT IN (:...excludedStates)", {
      excludedStates: ["ANULADA", "CONDONADA", "PAGADA"],
    });
    queryBuilder.andWhere("payable.fecha_vencimiento IS NOT NULL");
    queryBuilder.andWhere("payable.fecha_vencimiento < :todayChile", {
      todayChile: chileDate,
    });
    return queryBuilder;
  }

  if (state === "PENDIENTE") {
    queryBuilder.andWhere("payable.monto_pagado = 0");
    queryBuilder.andWhere("payable.saldo_pendiente > 0");
    queryBuilder.andWhere("payable.estado NOT IN (:...cancelledStates)", {
      cancelledStates: ["ANULADA", "CONDONADA"],
    });
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("payable.fecha_vencimiento IS NULL")
          .orWhere("payable.fecha_vencimiento >= :todayPending", {
            todayPending: chileDate,
          });
      }),
    );
  }

  return queryBuilder;
}

async function applyPayablesReportFilters(queryBuilder, filters = {}, dependencies = {}) {
  const {
    estado,
    proveedor_id,
    clinica_id,
    categoria_id,
    origen_tipo,
    moneda,
    solo_vencidas,
    con_saldo,
    search,
    fechaEmisionRange,
    vencimientoRange,
    chileDate,
  } = filters;

  if (fechaEmisionRange?.fromInclusive) {
    queryBuilder.andWhere("payable.fecha_emision >= :fechaEmisionDesde", {
      fechaEmisionDesde: fechaEmisionRange.fromInclusive,
    });
  }
  if (fechaEmisionRange?.toInclusive) {
    queryBuilder.andWhere("payable.fecha_emision <= :fechaEmisionHasta", {
      fechaEmisionHasta: fechaEmisionRange.toInclusive,
    });
  }

  if (vencimientoRange?.fromInclusive) {
    queryBuilder.andWhere("payable.fecha_vencimiento >= :vencimientoDesde", {
      vencimientoDesde: vencimientoRange.fromInclusive,
    });
  }
  if (vencimientoRange?.toInclusive) {
    queryBuilder.andWhere("payable.fecha_vencimiento <= :vencimientoHasta", {
      vencimientoHasta: vencimientoRange.toInclusive,
    });
  }

  applyPayableDerivedStateFilter(queryBuilder, estado, chileDate);

  if (proveedor_id) {
    queryBuilder.andWhere("UPPER(payable.proveedor_tipo) = :supplierType", {
      supplierType: "SUPPLIER",
    });
    queryBuilder.andWhere("payable.proveedor_id = :supplierId", {
      supplierId: Number(proveedor_id),
    });
  }

  if (clinica_id) {
    queryBuilder.andWhere("UPPER(payable.proveedor_tipo) = :clinicType", {
      clinicType: "VET_CLINIC",
    });
    queryBuilder.andWhere("payable.proveedor_id = :clinicId", {
      clinicId: Number(clinica_id),
    });
  }

  if (categoria_id) {
    queryBuilder.andWhere("category.categoria_transaccion_id = :categoriaId", {
      categoriaId: Number(categoria_id),
    });
  }

  if (origen_tipo) {
    queryBuilder.andWhere("UPPER(payable.origen_tipo) = :originType", {
      originType: origen_tipo,
    });
  }

  if (moneda) {
    queryBuilder.andWhere("payable.moneda = :moneda", { moneda });
  }

  if (solo_vencidas === true) {
    applyPayableDerivedStateFilter(queryBuilder, "VENCIDA", chileDate);
  }

  if (con_saldo === true) {
    queryBuilder.andWhere("payable.saldo_pendiente > 0");
  } else if (con_saldo === false) {
    queryBuilder.andWhere("payable.saldo_pendiente <= 0");
  }

  if (search) {
    const { supplierIds, clinicIds } = await buildPayableSearchMatches(search, dependencies);
    const searchPattern = `%${String(search).trim()}%`;
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("payable.descripcion ILIKE :search", { search: searchPattern })
          .orWhere("payable.origen_tipo ILIKE :search", { search: searchPattern })
          .orWhere("payable.proveedor_tipo ILIKE :search", { search: searchPattern })
          .orWhere("category.nombre ILIKE :search", { search: searchPattern })
          .orWhere("category.clave ILIKE :search", { search: searchPattern })
          .orWhere('CAST(payable.cuenta_por_pagar_id AS TEXT) ILIKE :search', {
            search: searchPattern,
          });

        if (supplierIds.length > 0) {
          subQuery.orWhere(
            "(UPPER(payable.proveedor_tipo) = :supplierSearchType AND payable.proveedor_id IN (:...supplierSearchIds))",
            {
              supplierSearchType: "SUPPLIER",
              supplierSearchIds: supplierIds,
            },
          );
        }

        if (clinicIds.length > 0) {
          subQuery.orWhere(
            "(UPPER(payable.proveedor_tipo) = :clinicSearchType AND payable.proveedor_id IN (:...clinicSearchIds))",
            {
              clinicSearchType: "VET_CLINIC",
              clinicSearchIds: clinicIds,
            },
          );
        }
      }),
    );
  }

  return queryBuilder;
}

async function loadPayablePaymentAggregates(payableIds = [], dependencies = {}) {
  if (!Array.isArray(payableIds) || payableIds.length === 0) {
    return new Map();
  }

  if (typeof dependencies.paymentAggregatesLoader === "function") {
    return dependencies.paymentAggregatesLoader(payableIds);
  }

  const paymentRepository = dependencies.paymentRepository
    || AppDataSource.getRepository(PayablePayment);
  const rawAggregates = await paymentRepository
    .createQueryBuilder("payment")
    .select("payable.cuenta_por_pagar_id", "payable_id")
    .addSelect("COUNT(payment.pago_cuenta_por_pagar_id)", "cantidad_pagos")
    .addSelect("MAX(payment.fecha_pago)", "ultima_fecha_pago")
    .addSelect("COALESCE(SUM(payment.monto_aplicado), 0)", "monto_pagado_calculado")
    .leftJoin("payment.payableAccount", "payable")
    .where("payable.cuenta_por_pagar_id IN (:...payableIds)", { payableIds })
    .groupBy("payable.cuenta_por_pagar_id")
    .getRawMany();

  return new Map(
    rawAggregates.map((item) => [
      Number(item.payable_id),
      {
        payable_id: Number(item.payable_id),
        cantidad_pagos: Number(item.cantidad_pagos || 0),
        ultima_fecha_pago: item.ultima_fecha_pago || null,
        monto_pagado_calculado: Number(item.monto_pagado_calculado || 0),
      },
    ]),
  );
}

async function loadCounterpartyLookups(payables = [], dependencies = {}) {
  const supplierIds = Array.from(new Set(
    payables
      .filter((item) => normalizeReportCode(item?.proveedor_tipo) === "SUPPLIER")
      .map((item) => Number(item.proveedor_id))
      .filter((item) => Number.isInteger(item) && item > 0),
  ));
  const clinicIds = Array.from(new Set(
    payables
      .filter((item) => normalizeReportCode(item?.proveedor_tipo) === "VET_CLINIC")
      .map((item) => Number(item.proveedor_id))
      .filter((item) => Number.isInteger(item) && item > 0),
  ));

  if (typeof dependencies.counterpartyLookupLoader === "function") {
    return dependencies.counterpartyLookupLoader({
      supplierIds,
      clinicIds,
    });
  }

  const supplierRepository = dependencies.supplierRepository
    || AppDataSource.getRepository(Supplier);
  const clinicRepository = dependencies.clinicRepository
    || AppDataSource.getRepository(VetClinic);
  const [suppliers, clinics] = await Promise.all([
    supplierIds.length > 0
      ? supplierRepository.find({
        where: supplierIds.map((proveedor_id) => ({ proveedor_id })),
      })
      : [],
    clinicIds.length > 0
      ? clinicRepository.find({
        where: clinicIds.map((id_clinica) => ({ id_clinica })),
      })
      : [],
  ]);

  return {
    suppliersById: new Map(
      suppliers.map((item) => [Number(item.proveedor_id), { proveedor_id: item.proveedor_id, nombre: item.nombre }]),
    ),
    clinicsById: new Map(
      clinics.map((item) => [Number(item.id_clinica), { id_clinica: item.id_clinica, nombre: item.nombre }]),
    ),
  };
}

function buildFiltersSnapshot(filters, page, limit) {
  return {
    fecha_emision_desde: filters.fechaEmisionRange?.normalized?.fecha_desde || null,
    fecha_emision_hasta: filters.fechaEmisionRange?.normalized?.fecha_hasta || null,
    vencimiento_desde: filters.vencimientoRange?.normalized?.fecha_desde || null,
    vencimiento_hasta: filters.vencimientoRange?.normalized?.fecha_hasta || null,
    estado: filters.estado || null,
    proveedor_id: filters.proveedor_id ? Number(filters.proveedor_id) : null,
    clinica_id: filters.clinica_id ? Number(filters.clinica_id) : null,
    categoria_id: filters.categoria_id ? Number(filters.categoria_id) : null,
    origen_tipo: filters.origen_tipo || null,
    moneda: filters.moneda || null,
    solo_vencidas: filters.solo_vencidas ?? null,
    con_saldo: filters.con_saldo ?? null,
    search: normalizeNullableString(filters.search),
    time_zone: "America/Santiago",
    page,
    limit,
  };
}

async function buildPayablesDisplayFilters(filters = {}, dependencies = {}) {
  const entries = [
    buildDisplayFilterEntry("Emision desde", filters.fecha_emision_desde ? formatExportDate(filters.fecha_emision_desde) : null),
    buildDisplayFilterEntry("Emision hasta", filters.fecha_emision_hasta ? formatExportDate(filters.fecha_emision_hasta) : null),
    buildDisplayFilterEntry("Vencimiento desde", filters.vencimiento_desde ? formatExportDate(filters.vencimiento_desde) : null),
    buildDisplayFilterEntry("Vencimiento hasta", filters.vencimiento_hasta ? formatExportDate(filters.vencimiento_hasta) : null),
    buildDisplayFilterEntry("Estado de la cuenta", filters.estado ? formatAccountingExportLabel(filters.estado) : null),
  ];

  if (filters.proveedor_id) {
    const supplierRepository = dependencies.supplierRepository
      || AppDataSource.getRepository(Supplier);
    const supplier = await supplierRepository.findOne({
      where: { proveedor_id: Number(filters.proveedor_id) },
    });
    entries.push(
      buildDisplayFilterEntry(
        "Proveedor",
        supplier?.nombre || "Registro no disponible",
      ),
    );
  }

  if (filters.clinica_id) {
    const clinicRepository = dependencies.clinicRepository
      || AppDataSource.getRepository(VetClinic);
    const clinic = await clinicRepository.findOne({
      where: { id_clinica: Number(filters.clinica_id) },
    });
    entries.push(
      buildDisplayFilterEntry(
        "Clinica veterinaria",
        clinic?.nombre || "Registro no disponible",
      ),
    );
  }

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

  entries.push(
    buildDisplayFilterEntry("Tipo de origen", filters.origen_tipo ? formatAccountingExportLabel(filters.origen_tipo) : null),
    buildDisplayFilterEntry("Moneda", filters.moneda || null),
    buildDisplayFilterEntry("Solo vencidas", filters.solo_vencidas === null ? null : formatAccountingExportLabel(String(filters.solo_vencidas))),
    buildDisplayFilterEntry("Solo con saldo pendiente", filters.con_saldo === null ? null : formatAccountingExportLabel(String(filters.con_saldo))),
    buildDisplayFilterEntry("Buscar", filters.search || null),
  );

  return entries.filter(Boolean);
}

async function loadPayablePaymentRows(payableIds = [], dependencies = {}) {
  if (!Array.isArray(payableIds) || payableIds.length === 0) {
    return [];
  }

  if (typeof dependencies.paymentRowsLoader === "function") {
    return dependencies.paymentRowsLoader(payableIds);
  }

  const paymentRepository = dependencies.paymentRepository
    || AppDataSource.getRepository(PayablePayment);
  const payments = await paymentRepository
    .createQueryBuilder("payment")
    .leftJoinAndSelect("payment.payableAccount", "payable")
    .leftJoinAndSelect("payment.transaction", "transaction")
    .leftJoinAndSelect("transaction.payment_provider", "paymentProvider")
    .where("payable.cuenta_por_pagar_id IN (:...payableIds)", { payableIds })
    .orderBy("payment.fecha_pago", "ASC")
    .addOrderBy("payment.pago_cuenta_por_pagar_id", "ASC")
    .getMany();

  return payments.map((payment) => ({
    payment_id: Number(payment.pago_cuenta_por_pagar_id || 0),
    payable_id: Number(payment.payableAccount?.cuenta_por_pagar_id || 0),
    fecha_pago: payment.fecha_pago || null,
    monto_aplicado: toReportNumber(payment.monto_aplicado, "monto_aplicado"),
    moneda: normalizeReportCode(payment.payableAccount?.moneda) || "CLP",
    proveedor_pago: payment.transaction?.payment_provider
      ? {
          id: Number(payment.transaction.payment_provider.proveedor_pago_id || 0),
          nombre: payment.transaction.payment_provider.nombre || "",
          tipo: payment.transaction.payment_provider.tipo || "",
        }
      : null,
    referencia_segura: payment.transaction?.referencia_externa || null,
    transaction_id: payment.transaction?.transaccion_id
      ? Number(payment.transaction.transaccion_id)
      : null,
  }));
}

async function buildPayablesReportDataset(query = {}, authContext = {}, dependencies = {}, options = {}) {
  const repository = dependencies.repository || AppDataSource.getRepository(PayableAccount);
  const pagination = options.paginate !== false
    ? normalizeReportPagination(query)
    : { page: null, limit: null, skip: 0 };
  const chileDate = getCurrentChileDateTime(dependencies.now || new Date()).chileDate;

  const normalizedFilters = {
    estado: normalizeReportCode(query.estado),
    proveedor_id: query.proveedor_id ? Number(query.proveedor_id) : null,
    clinica_id: query.clinica_id ? Number(query.clinica_id) : null,
    categoria_id: query.categoria_id ? Number(query.categoria_id) : null,
    origen_tipo: normalizeReportCode(query.origen_tipo),
    moneda: normalizeReportCode(query.moneda),
    solo_vencidas: query.solo_vencidas,
    con_saldo: query.con_saldo,
    search: normalizeNullableString(query.search),
    chileDate,
  };

  if (query.fecha_emision_desde || query.fecha_emision_hasta) {
    normalizedFilters.fechaEmisionRange = buildChileReportDateRange({
      fecha_desde: query.fecha_emision_desde,
      fecha_hasta: query.fecha_emision_hasta,
      fieldType: REPORT_FIELD_TYPES.DATE,
      now: dependencies.now || new Date(),
    });
  }

  if (query.vencimiento_desde || query.vencimiento_hasta) {
    normalizedFilters.vencimientoRange = buildChileReportDateRange({
      fecha_desde: query.vencimiento_desde,
      fecha_hasta: query.vencimiento_hasta,
      fieldType: REPORT_FIELD_TYPES.DATE,
      now: dependencies.now || new Date(),
    });
  }

  const filteredQuery = await applyPayablesReportFilters(
    buildBasePayablesReportQuery(repository),
    normalizedFilters,
    dependencies,
  );

  const allPayables = await filteredQuery
    .clone()
    .orderBy("payable.fecha_vencimiento", "ASC", "NULLS LAST")
    .addOrderBy("payable.cuenta_por_pagar_id", "DESC")
    .getMany();

  const paymentAggregatesById = await loadPayablePaymentAggregates(
    allPayables.map((item) => Number(item.cuenta_por_pagar_id)),
    dependencies,
  );
  const summaryLookups = await loadCounterpartyLookups(allPayables, dependencies);
  const { summary, warnings } = summarizePayables(allPayables, {
    chileDate,
    paymentAggregatesById,
    suppliersById: summaryLookups.suppliersById,
    clinicsById: summaryLookups.clinicsById,
  });
  const allRows = allPayables.map((payable) => buildPayableReportRow(payable, {
    chileDate,
    paymentAggregatesById,
    suppliersById: summaryLookups.suppliersById,
    clinicsById: summaryLookups.clinicsById,
  }));
  const pagedRows = options.paginate === false
    ? allRows
    : allRows.slice(pagination.skip, pagination.skip + pagination.limit);
  return {
    report_type: REPORT_TYPES.ACCOUNTING_PAYABLES,
    generated_by: authContext.user || null,
    filters: buildFiltersSnapshot(normalizedFilters, pagination.page, pagination.limit),
    summary,
    warnings,
    rows: pagedRows,
    all_rows: allRows,
    payments: options.paginate === false
      ? await loadPayablePaymentRows(
          allPayables.map((item) => Number(item.cuenta_por_pagar_id)),
          dependencies,
        )
      : [],
    total_rows: allRows.length,
    pagination: options.paginate === false
      ? null
      : buildReportPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: allRows.length,
        }),
  };
}

export async function getPayablesReportPreviewService(query = {}, authContext = {}, dependencies = {}) {
  try {
    const dataset = await buildPayablesReportDataset(query, authContext, dependencies, {
      paginate: true,
    });

    return [
      buildReportPreviewResponse({
        reportType: REPORT_TYPES.ACCOUNTING_PAYABLES,
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
    console.error("Error al generar preview del informe de cuentas por pagar:", error);
    return [null, error.message || "Error interno al generar el informe de cuentas por pagar"];
  }
}

export async function getPayablesReportExportService(query = {}, authContext = {}, dependencies = {}) {
  try {
    const dataset = await buildPayablesReportDataset(query, authContext, dependencies, {
      paginate: false,
    });

    return [
      {
        report_type: dataset.report_type,
        generated_by: authContext.user || null,
        filters: {
          ...dataset.filters,
          display_filters: await buildPayablesDisplayFilters(dataset.filters, dependencies),
        },
        summary: dataset.summary,
        warnings: dataset.warnings,
        rows: dataset.all_rows,
        payments: dataset.payments,
        total_rows: dataset.total_rows,
      },
      null,
    ];
  } catch (error) {
    console.error("Error al generar dataset de exportacion del informe de cuentas por pagar:", error);
    return [null, error.message || "Error interno al generar el informe de cuentas por pagar"];
  }
}

export {
  applyPayablesReportFilters,
  buildBasePayablesReportQuery,
  buildPayablesReportDataset,
  loadPayablePaymentAggregates,
  loadPayablePaymentRows,
};

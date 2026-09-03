"use strict";

import { Brackets } from "typeorm";
import InventoryExistence from "../../entities/inventoryConcept/inventory_existence.entity.js";
import { AppDataSource } from "../../config/configDb.js";
import {
  REPORT_TYPES,
} from "../reporting/report.constants.js";
import {
  buildReportPaginationMeta,
  buildReportPreviewResponse,
  normalizeReportPagination,
  toReportNumber,
} from "../reporting/report.shared.js";
import {
  resolveReadScope,
} from "./inventory.shared.js";

export const INVENTORY_EXISTENCE_REPORT_STOCK_STATES = [
  "SIN_STOCK",
  "BAJO_MINIMO",
  "DISPONIBLE",
];

export const INVENTORY_EXISTENCE_AGGREGATION_FIELDS = [
  { property: "estado", alias: "distinct_estado_count" },
  { property: "condicion", alias: "distinct_condicion_count" },
  { property: "origen_tipo", alias: "distinct_origen_tipo_count" },
  { property: "fecha_vencimiento", alias: "distinct_fecha_vencimiento_count" },
  { property: "fecha_apertura", alias: "distinct_fecha_apertura_count" },
];

export function classifyInventoryExistence({
  quantity,
  minimumStock,
}) {
  const normalizedQuantity = toReportNumber(quantity, "cantidad_actual");
  const normalizedMinimum = minimumStock === null || minimumStock === undefined || minimumStock === ""
    ? null
    : toReportNumber(minimumStock, "stock_minimo");

  if (normalizedQuantity <= 0) {
    return "SIN_STOCK";
  }

  if (normalizedMinimum !== null && normalizedQuantity < normalizedMinimum) {
    return "BAJO_MINIMO";
  }

  return "DISPONIBLE";
}

function normalizeBooleanFilter(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  return null;
}

function normalizeSearch(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeStockState(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return INVENTORY_EXISTENCE_REPORT_STOCK_STATES.includes(normalized)
    ? normalized
    : null;
}

export function buildInventoryExistenceReportRow(rawRow) {
  const quantity = toReportNumber(rawRow.cantidad_actual, "cantidad_actual");
  const minimumStock = rawRow.stock_minimo === null || rawRow.stock_minimo === undefined
    ? null
    : toReportNumber(rawRow.stock_minimo, "stock_minimo");
  const stockState = classifyInventoryExistence({
    quantity,
    minimumStock,
  });
  const persistenceRows = Number(rawRow.persistence_rows || 1);
  const mixedFields = INVENTORY_EXISTENCE_AGGREGATION_FIELDS
    .filter((field) => Number(rawRow[field.alias] || 0) > 1)
    .map((field) => field.property);

  return {
    existence_id: Number(rawRow.existence_id || 0),
    item: {
      id: Number(rawRow.item_id || 0),
      codigo: null,
      nombre: rawRow.item_nombre || "",
      activo: rawRow.item_activo === true || rawRow.item_activo === "true",
    },
    categoria: rawRow.categoria_item_id
      ? {
          id: Number(rawRow.categoria_item_id),
          nombre: rawRow.categoria_nombre || "",
        }
      : null,
    unidad: rawRow.unidad_medida_id
      ? {
          id: Number(rawRow.unidad_medida_id),
          nombre: rawRow.unidad_nombre || "",
          abreviatura: null,
          activa: rawRow.unidad_activa === true || rawRow.unidad_activa === "true",
        }
      : null,
    ubicacion: rawRow.ubicacion_id
      ? {
          id: Number(rawRow.ubicacion_id),
          nombre: rawRow.ubicacion_nombre || "",
          activa: rawRow.ubicacion_activa === true || rawRow.ubicacion_activa === "true",
          tipo: rawRow.ubicacion_tipo || null,
        }
      : null,
    cantidad_actual: quantity,
    stock_minimo: minimumStock,
    diferencia_minimo: minimumStock === null
      ? null
      : Number((quantity - minimumStock).toFixed(2)),
    estado_stock: stockState,
    aggregation: {
      persistence_rows: persistenceRows,
      heterogeneous: mixedFields.length > 0,
      mixed_fields: mixedFields,
    },
    actualizado_en: rawRow.actualizado_en
      ? new Date(rawRow.actualizado_en).toISOString()
      : null,
  };
}

export function summarizeInventoryExistenceRows(rows = []) {
  const summary = {
    existencias_totales: 0,
    items_distintos: 0,
    ubicaciones_distintas: 0,
    sin_stock: 0,
    bajo_minimo: 0,
    disponibles: 0,
    por_categoria: [],
    por_ubicacion: [],
    cantidades_por_unidad: [],
  };

  const itemIds = new Set();
  const locationIds = new Set();
  const categoryBuckets = new Map();
  const locationBuckets = new Map();
  const unitBuckets = new Map();
  const warnings = new Set();

  for (const rawRow of rows) {
    const row = buildInventoryExistenceReportRow(rawRow);
    const persistenceRows = row.aggregation.persistence_rows;

    summary.existencias_totales += 1;
    itemIds.add(row.item.id);
    if (row.ubicacion?.id) {
      locationIds.add(row.ubicacion.id);
    }

    if (row.estado_stock === "SIN_STOCK") summary.sin_stock += 1;
    if (row.estado_stock === "BAJO_MINIMO") summary.bajo_minimo += 1;
    if (row.estado_stock === "DISPONIBLE") summary.disponibles += 1;

    if (row.cantidad_actual < 0) {
      warnings.add("Existen existencias con cantidad negativa.");
    }

    if (!row.unidad) {
      warnings.add("Existen existencias sin unidad de medida resoluble.");
    }

    if (!row.ubicacion) {
      warnings.add("Existen existencias sin ubicacion resoluble.");
    }

    if (row.stock_minimo !== null && !Number.isFinite(row.stock_minimo)) {
      warnings.add("Existen existencias con stock minimo invalido.");
    }

    if (persistenceRows > 1) {
      warnings.add(
        "Existen multiples filas persistidas para una misma combinacion item + ubicacion; el informe las agrupa logicamente.",
      );
    }

    if (row.aggregation.heterogeneous) {
      warnings.add(
        `Existen agregaciones item + ubicacion con heterogeneidad real en: ${row.aggregation.mixed_fields.join(", ")}.`,
      );
    }

    if (row.cantidad_actual > 0 && row.item.activo === false) {
      warnings.add("Existen items inactivos con stock positivo.");
    }

    if (row.cantidad_actual > 0 && row.ubicacion?.activa === false) {
      warnings.add("Existen ubicaciones inactivas con stock positivo.");
    }

    const categoryKey = row.categoria?.id || "SIN_CATEGORIA";
    const categoryBucket = categoryBuckets.get(categoryKey) || {
      categoria_id: row.categoria?.id || null,
      categoria_nombre: row.categoria?.nombre || "Sin categoria",
      existencias: 0,
      sin_stock: 0,
      bajo_minimo: 0,
    };
    categoryBucket.existencias += 1;
    if (row.estado_stock === "SIN_STOCK") categoryBucket.sin_stock += 1;
    if (row.estado_stock === "BAJO_MINIMO") categoryBucket.bajo_minimo += 1;
    categoryBuckets.set(categoryKey, categoryBucket);

    const locationKey = row.ubicacion?.id || "SIN_UBICACION";
    const locationBucket = locationBuckets.get(locationKey) || {
      ubicacion_id: row.ubicacion?.id || null,
      ubicacion_nombre: row.ubicacion?.nombre || "Sin ubicacion",
      existencias: 0,
      sin_stock: 0,
      bajo_minimo: 0,
    };
    locationBucket.existencias += 1;
    if (row.estado_stock === "SIN_STOCK") locationBucket.sin_stock += 1;
    if (row.estado_stock === "BAJO_MINIMO") locationBucket.bajo_minimo += 1;
    locationBuckets.set(locationKey, locationBucket);

    if (row.unidad) {
      const unitKey = row.unidad.id;
      const unitBucket = unitBuckets.get(unitKey) || {
        unidad_id: row.unidad.id,
        unidad_nombre: row.unidad.nombre,
        total: 0,
      };
      unitBucket.total = Number((unitBucket.total + row.cantidad_actual).toFixed(2));
      unitBuckets.set(unitKey, unitBucket);
    }
  }

  summary.items_distintos = itemIds.size;
  summary.ubicaciones_distintas = locationIds.size;
  summary.por_categoria = Array.from(categoryBuckets.values()).sort((left, right) =>
    left.categoria_nombre.localeCompare(right.categoria_nombre, "es"));
  summary.por_ubicacion = Array.from(locationBuckets.values()).sort((left, right) =>
    left.ubicacion_nombre.localeCompare(right.ubicacion_nombre, "es"));
  summary.cantidades_por_unidad = Array.from(unitBuckets.values()).sort((left, right) =>
    left.unidad_nombre.localeCompare(right.unidad_nombre, "es"));

  return {
    summary,
    warnings: Array.from(warnings),
  };
}

function buildBaseInventoryExistenceReportQuery(repository) {
  return repository
    .createQueryBuilder("existence")
    .leftJoin("existence.item", "item")
    .leftJoin("item.categoria", "category")
    .leftJoin("item.unidad_medida", "unit")
    .leftJoin("existence.location", "location")
    .select("MIN(existence.existencia_id)", "existence_id")
    .addSelect("item.item_id", "item_id")
    .addSelect("item.nombre", "item_nombre")
    .addSelect("item.activo", "item_activo")
    .addSelect("category.categoria_item_id", "categoria_item_id")
    .addSelect("category.nombre_categoria", "categoria_nombre")
    .addSelect("unit.unidad_medida_id", "unidad_medida_id")
    .addSelect("unit.nombre", "unidad_nombre")
    .addSelect("unit.activo", "unidad_activa")
    .addSelect("location.ubicacion_id", "ubicacion_id")
    .addSelect("location.nombre_ubicacion", "ubicacion_nombre")
    .addSelect("location.tipo", "ubicacion_tipo")
    .addSelect("location.activo", "ubicacion_activa")
    .addSelect("COALESCE(SUM(existence.cantidad_actual), 0)", "cantidad_actual")
    .addSelect("item.stock_minimo", "stock_minimo")
    .addSelect("MAX(existence.updatedAt)", "actualizado_en")
    .addSelect("COUNT(existence.existencia_id)", "persistence_rows")
    .addSelect(
      "COUNT(DISTINCT COALESCE(existence.estado::text, '__NULL__'))",
      "distinct_estado_count",
    )
    .addSelect(
      "COUNT(DISTINCT COALESCE(existence.condicion::text, '__NULL__'))",
      "distinct_condicion_count",
    )
    .addSelect(
      "COUNT(DISTINCT COALESCE(existence.origen_tipo::text, '__NULL__'))",
      "distinct_origen_tipo_count",
    )
    .addSelect(
      "COUNT(DISTINCT COALESCE(TO_CHAR(existence.fecha_vencimiento, 'YYYY-MM-DD'), '__NULL__'))",
      "distinct_fecha_vencimiento_count",
    )
    .addSelect(
      "COUNT(DISTINCT COALESCE(TO_CHAR(existence.fecha_apertura, 'YYYY-MM-DD'), '__NULL__'))",
      "distinct_fecha_apertura_count",
    )
    .groupBy("item.item_id")
    .addGroupBy("item.nombre")
    .addGroupBy("item.activo")
    .addGroupBy("item.stock_minimo")
    .addGroupBy("category.categoria_item_id")
    .addGroupBy("category.nombre_categoria")
    .addGroupBy("unit.unidad_medida_id")
    .addGroupBy("unit.nombre")
    .addGroupBy("unit.activo")
    .addGroupBy("location.ubicacion_id")
    .addGroupBy("location.nombre_ubicacion")
    .addGroupBy("location.tipo")
    .addGroupBy("location.activo");
}

function applyInventoryExistenceStateFilter(queryBuilder, stockState) {
  if (!stockState) {
    return queryBuilder;
  }

  if (stockState === "SIN_STOCK") {
    queryBuilder.having("COALESCE(SUM(existence.cantidad_actual), 0) <= 0");
    return queryBuilder;
  }

  if (stockState === "BAJO_MINIMO") {
    queryBuilder.having("COALESCE(SUM(existence.cantidad_actual), 0) > 0");
    queryBuilder.andHaving("item.stock_minimo IS NOT NULL");
    queryBuilder.andHaving("COALESCE(SUM(existence.cantidad_actual), 0) < item.stock_minimo");
    return queryBuilder;
  }

  if (stockState === "DISPONIBLE") {
    queryBuilder.having("COALESCE(SUM(existence.cantidad_actual), 0) > 0");
    queryBuilder.andHaving(
      "(item.stock_minimo IS NULL OR COALESCE(SUM(existence.cantidad_actual), 0) >= item.stock_minimo)",
    );
  }

  return queryBuilder;
}

function applyInventoryExistenceReportFilters(queryBuilder, filters = {}) {
  if (filters.scopeLocationId) {
    queryBuilder.andWhere("location.ubicacion_id = :scopeLocationId", {
      scopeLocationId: Number(filters.scopeLocationId),
    });
  }

  if (filters.categoria_id) {
    queryBuilder.andWhere("category.categoria_item_id = :categoriaId", {
      categoriaId: Number(filters.categoria_id),
    });
  }

  if (filters.ubicacion_id) {
    queryBuilder.andWhere("location.ubicacion_id = :ubicacionId", {
      ubicacionId: Number(filters.ubicacion_id),
    });
  }

  if (filters.item_id) {
    queryBuilder.andWhere("item.item_id = :itemId", {
      itemId: Number(filters.item_id),
    });
  }

  if (filters.unidad_id) {
    queryBuilder.andWhere("unit.unidad_medida_id = :unidadId", {
      unidadId: Number(filters.unidad_id),
    });
  }

  if (filters.activo === true) {
    queryBuilder.andWhere("item.activo = true");
    queryBuilder.andWhere("location.activo = true");
  } else if (filters.activo === false) {
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("item.activo = false")
          .orWhere("location.activo = false");
      }),
    );
  }

  if (filters.search) {
    const pattern = `%${String(filters.search).trim()}%`;
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("item.nombre ILIKE :search", { search: pattern })
          .orWhere("item.descripcion ILIKE :search", { search: pattern })
          .orWhere("location.nombre_ubicacion ILIKE :search", { search: pattern })
          .orWhere("category.nombre_categoria ILIKE :search", { search: pattern });
      }),
    );
  }

  const derivedState = filters.estado_stock
    || (filters.solo_sin_stock === true ? "SIN_STOCK" : null)
    || (filters.solo_bajo_minimo === true ? "BAJO_MINIMO" : null);

  applyInventoryExistenceStateFilter(queryBuilder, derivedState);

  return queryBuilder;
}

function buildFilteredGroupedExistenceCountQuery(filteredQuery) {
  return AppDataSource
    .createQueryBuilder()
    .select("COUNT(*)", "total")
    .from(`(${filteredQuery.getQuery()})`, "filtered_existences")
    .setParameters(filteredQuery.getParameters());
}

function buildFiltersSnapshot(filters, page, limit) {
  return {
    categoria_id: filters.categoria_id ? Number(filters.categoria_id) : null,
    ubicacion_id: filters.ubicacion_id ? Number(filters.ubicacion_id) : null,
    item_id: filters.item_id ? Number(filters.item_id) : null,
    unidad_id: filters.unidad_id ? Number(filters.unidad_id) : null,
    estado_stock: filters.estado_stock || null,
    solo_sin_stock: filters.solo_sin_stock ?? null,
    solo_bajo_minimo: filters.solo_bajo_minimo ?? null,
    activo: filters.activo ?? null,
    search: normalizeSearch(filters.search),
    page,
    limit,
  };
}

async function buildInventoryExistencesReportDataset(
  query = {},
  authContext = {},
  dependencies = {},
  options = {},
) {
  const repository = dependencies.repository || AppDataSource.getRepository(InventoryExistence);
  const manager = dependencies.manager || AppDataSource.manager;
  const pagination = options.paginate !== false
    ? normalizeReportPagination(query)
    : { page: null, limit: null, skip: 0 };

  const scope = dependencies.scope || await resolveReadScope(manager, authContext);
  const normalizedFilters = {
    categoria_id: query.categoria_id ? Number(query.categoria_id) : null,
    ubicacion_id: query.ubicacion_id ? Number(query.ubicacion_id) : null,
    item_id: query.item_id ? Number(query.item_id) : null,
    unidad_id: query.unidad_id ? Number(query.unidad_id) : null,
    estado_stock: normalizeStockState(query.estado_stock),
    solo_sin_stock: normalizeBooleanFilter(query.solo_sin_stock),
    solo_bajo_minimo: normalizeBooleanFilter(query.solo_bajo_minimo),
    activo: normalizeBooleanFilter(query.activo),
    search: normalizeSearch(query.search),
    scopeLocationId: scope.mode === "location" ? Number(scope.userLocationId) : null,
  };

  const filteredQuery = applyInventoryExistenceReportFilters(
    buildBaseInventoryExistenceReportQuery(repository),
    normalizedFilters,
  );

  const total = typeof dependencies.totalCountLoader === "function"
    ? Number(await dependencies.totalCountLoader(filteredQuery.clone()))
    : Number(
      (
        await buildFilteredGroupedExistenceCountQuery(
          filteredQuery.clone(),
        ).getRawOne()
      )?.total || 0,
    );
  const allRawRows = await filteredQuery
    .clone()
    .orderBy("item.nombre", "ASC")
    .addOrderBy("location.nombre_ubicacion", "ASC")
    .addOrderBy("MIN(existence.existencia_id)", "ASC")
    .getRawMany();
  const allRows = allRawRows.map(buildInventoryExistenceReportRow);
  const { summary, warnings } = summarizeInventoryExistenceRows(allRawRows);

  return {
    report_type: REPORT_TYPES.INVENTORY_EXISTENCES,
    generated_by: authContext.user || null,
    filters: buildFiltersSnapshot(normalizedFilters, pagination.page, pagination.limit),
    summary,
    warnings,
    rows: options.paginate === false
      ? allRows
      : allRows.slice(pagination.skip, pagination.skip + pagination.limit),
    all_rows: allRows,
    total_rows: total,
    pagination: options.paginate === false
      ? null
      : buildReportPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total,
        }),
  };
}

export async function getInventoryExistencesReportPreviewService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildInventoryExistencesReportDataset(
      query,
      authContext,
      dependencies,
      { paginate: true },
    );

    return [
      buildReportPreviewResponse({
        reportType: REPORT_TYPES.INVENTORY_EXISTENCES,
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
    console.error("Error al generar preview del informe de existencias:", error);
    return [null, error.message || "Error interno al generar el informe de existencias"];
  }
}

export async function getInventoryExistencesReportExportService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildInventoryExistencesReportDataset(
      query,
      authContext,
      dependencies,
      { paginate: false },
    );

    return [
      {
        report_type: dataset.report_type,
        generated_by: authContext.user || null,
        filters: dataset.filters,
        summary: dataset.summary,
        warnings: dataset.warnings,
        rows: dataset.all_rows,
        total_rows: dataset.total_rows,
      },
      null,
    ];
  } catch (error) {
    console.error("Error al generar dataset de exportacion del informe de existencias:", error);
    return [null, error.message || "Error interno al generar el informe de existencias"];
  }
}

export {
  applyInventoryExistenceReportFilters,
  buildBaseInventoryExistenceReportQuery,
  buildInventoryExistencesReportDataset,
};

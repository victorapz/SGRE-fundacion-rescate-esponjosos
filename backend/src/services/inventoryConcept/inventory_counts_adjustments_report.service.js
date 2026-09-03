"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  InventoryAdjustment,
  InventoryMovement,
  StockCount,
  resolveReadScope,
} from "./inventory.shared.js";
import { REPORT_FIELD_TYPES, REPORT_TYPES } from "../reporting/report.constants.js";
import {
  buildChileReportDateRange,
  buildReportGeneratedBy,
  buildReportPaginationMeta,
  getCurrentChileDateTime,
  normalizeReportPagination,
  toReportNumber,
} from "../reporting/report.shared.js";

const COUNT_DETAIL_PREVIEW_LIMIT = 20;
const ADJUSTMENT_DETAIL_PREVIEW_LIMIT = 20;

export const PHYSICAL_COUNT_DIFFERENCE_CLASSIFICATIONS = [
  "SOBRANTE",
  "FALTANTE",
  "SIN_DIFERENCIA",
];

export const PHYSICAL_COUNT_DATA_QUALITY = [
  "HISTORICO_CONFIRMADO",
  "DERIVADO_DESDE_EXISTENCIA_ACTUAL",
  "NO_RESOLUBLE",
];

export const INVENTORY_ADJUSTMENT_REPORT_TYPES = [
  "POSITIVO",
  "NEGATIVO",
];

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

function normalizeUppercaseAllowlist(value, allowlist) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().toUpperCase();
  return allowlist.includes(normalized) ? normalized : null;
}

function buildDifferenceKey(itemId, existenceId) {
  return `${Number(itemId || 0)}::${existenceId ? Number(existenceId) : "none"}`;
}

function mapUserSummary(user) {
  if (!user) return null;
  return {
    id: Number(user.id_usuario || 0),
    nombre: `${user.nombre || ""} ${user.apellido || ""}`.trim() || user.email || "",
  };
}

function mapLocationSummary(location) {
  if (!location) return null;
  return {
    id: Number(location.ubicacion_id || 0),
    nombre: location.nombre_ubicacion || "",
    tipo: location.tipo || null,
  };
}

function mapItemSummary(item) {
  if (!item) return null;
  return {
    id: Number(item.item_id || 0),
    nombre: item.nombre || "",
  };
}

function mapCategorySummary(item) {
  if (!item?.categoria) return null;
  return {
    id: Number(item.categoria.categoria_item_id || 0),
    nombre: item.categoria.nombre_categoria || "",
  };
}

function mapUnitSummary(item) {
  if (!item?.unidad_medida) return null;
  return {
    id: Number(item.unidad_medida.unidad_medida_id || 0),
    nombre: item.unidad_medida.nombre || "",
  };
}

function safeIsoDate(dateValue) {
  if (!dateValue) return null;
  return new Date(dateValue).toISOString().slice(0, 10);
}

function pushStructuredWarning(warnings, warning) {
  if (!warning?.code || !warning?.message) return;

  warnings.set(warning.code, {
    severity: warning.severity || "warning",
    ...warning,
  });
}

export function classifyPhysicalCountDifference({
  expectedQuantity,
  countedQuantity,
}) {
  const expected = toReportNumber(expectedQuantity, "cantidad_teorica");
  const counted = toReportNumber(countedQuantity, "cantidad_contada");
  const difference = Number((counted - expected).toFixed(2));

  if (difference > 0) {
    return {
      expected,
      counted,
      difference,
      classification: "SOBRANTE",
    };
  }

  if (difference < 0) {
    return {
      expected,
      counted,
      difference,
      classification: "FALTANTE",
    };
  }

  return {
    expected,
    counted,
    difference,
    classification: "SIN_DIFERENCIA",
  };
}

export function resolveAdjustmentImpact(adjustmentDetail = {}) {
  const previousQuantity = toReportNumber(
    adjustmentDetail.cantidad_antes,
    "cantidad_antes",
  );
  const countedQuantity = toReportNumber(
    adjustmentDetail.cantidad_contada,
    "cantidad_contada",
  );
  const storedDifference = toReportNumber(
    adjustmentDetail.diferencia,
    "diferencia",
  );
  const resolvedDifference = storedDifference;
  const impact = resolvedDifference >= 0 ? "INCREMENTO" : "DISMINUCION";

  return {
    impact,
    quantity: Number(Math.abs(resolvedDifference).toFixed(2)),
    previousQuantity,
    nextQuantity: countedQuantity,
    appliedDifference: resolvedDifference,
    countedQuantity,
    adjustmentType: adjustmentDetail.tipo_ajuste || null,
    derivedDifference: Number((countedQuantity - previousQuantity).toFixed(2)),
  };
}

function loadAdjustmentDetailPools(adjustments = []) {
  const pools = new Map();

  for (const adjustment of adjustments) {
    for (const detail of adjustment.inventory_adjustment_detail || []) {
      const key = buildDifferenceKey(detail.item?.item_id, detail.existence?.existencia_id);
      const current = pools.get(key) || [];
      current.push({
        adjustment,
        detail,
      });
      pools.set(key, current);
    }
  }

  return pools;
}

function pullMatchingAdjustmentDetail(poolMap, countDetail) {
  const exactKey = buildDifferenceKey(
    countDetail.item?.item_id,
    countDetail.existence?.existencia_id,
  );
  const exactPool = poolMap.get(exactKey) || [];
  if (exactPool.length > 0) {
    return exactPool.shift();
  }

  const itemOnlyKey = buildDifferenceKey(countDetail.item?.item_id, null);
  const itemOnlyPool = poolMap.get(itemOnlyKey) || [];
  if (itemOnlyPool.length > 0) {
    return itemOnlyPool.shift();
  }

  return null;
}

function buildPhysicalCountDetailRow(detail, adjustmentDetailPool, warnings) {
  const detailMatch = pullMatchingAdjustmentDetail(adjustmentDetailPool, detail);

  let expectedQuantity = null;
  let countedQuantity = null;
  let differenceInfo = null;
  let dataQuality = "NO_RESOLUBLE";

  if (detailMatch?.detail) {
    expectedQuantity = detailMatch.detail.cantidad_antes;
    countedQuantity = detailMatch.detail.cantidad_contada;
    differenceInfo = classifyPhysicalCountDifference({
      expectedQuantity,
      countedQuantity,
    });
    dataQuality = "HISTORICO_CONFIRMADO";

    const persistedDifference = toReportNumber(
      detailMatch.detail.diferencia,
      "diferencia",
    );
    if (differenceInfo.difference !== persistedDifference) {
      pushStructuredWarning(warnings, {
        code: "ADJUSTMENT_DIFFERENCE_MISMATCH",
        message:
          "Existen detalles de ajuste cuya diferencia persistida no coincide con la derivada desde cantidad_antes y cantidad_contada.",
      });
    }
  } else if (detail.existence?.cantidad_actual !== undefined && detail.existence?.cantidad_actual !== null) {
    expectedQuantity = detail.existence.cantidad_actual;
    countedQuantity = detail.cantidad_contada;
    differenceInfo = classifyPhysicalCountDifference({
      expectedQuantity,
      countedQuantity,
    });
    dataQuality = "DERIVADO_DESDE_EXISTENCIA_ACTUAL";
    pushStructuredWarning(warnings, {
      code: "COUNT_DETAIL_DERIVED_FROM_CURRENT_EXISTENCE",
      message:
        "Parte de las diferencias de conteo se derivan desde la existencia actual porque el modelo no persiste una cantidad teorica historica en StockCountDetail.",
    });
  } else {
    countedQuantity = toReportNumber(detail.cantidad_contada, "cantidad_contada");
    pushStructuredWarning(warnings, {
      code: "COUNT_DETAIL_UNRESOLVABLE_HISTORICAL_BASELINE",
      message:
        "Existen detalles de conteo sin cantidad teorica historica resoluble; se muestran sin clasificacion derivada.",
    });
  }

  if (!detail.item) {
    pushStructuredWarning(warnings, {
      code: "COUNT_DETAIL_ITEM_UNRESOLVED",
      message: "Existen detalles de conteo sin item resoluble.",
    });
  }

  if (!detail.item?.unidad_medida) {
    pushStructuredWarning(warnings, {
      code: "COUNT_DETAIL_UNIT_UNRESOLVED",
      message: "Existen detalles de conteo sin unidad de medida resoluble.",
    });
  }

  return {
    detail_id: Number(detail.conteo_detalle_id || 0),
    item: mapItemSummary(detail.item),
    categoria: mapCategorySummary(detail.item),
    unidad: mapUnitSummary(detail.item),
    existencia_id: detail.existence?.existencia_id
      ? Number(detail.existence.existencia_id)
      : null,
    cantidad_teorica: differenceInfo ? differenceInfo.expected : null,
    cantidad_contada: differenceInfo ? differenceInfo.counted : countedQuantity,
    diferencia: differenceInfo ? differenceInfo.difference : null,
    clasificacion: differenceInfo ? differenceInfo.classification : null,
    data_quality: dataQuality,
    ajuste_vinculado: detailMatch?.adjustment
      ? {
          adjustment_id: Number(detailMatch.adjustment.ajuste_inventario_id || 0),
          detail_id: Number(detailMatch.detail?.ajuste_detalle_id || 0),
        }
      : null,
    observaciones: detail.observaciones || null,
  };
}

function buildCountRows(stockCounts, linkedAdjustmentsByCount) {
  const warnings = new Map();
  const rows = [];

  for (const stockCount of stockCounts || []) {
    const linkedAdjustments = linkedAdjustmentsByCount.get(
      Number(stockCount.conteo_fisico_id),
    ) || [];
    const adjustmentDetailPool = loadAdjustmentDetailPools(linkedAdjustments);
    const detailRows = (stockCount.details || []).map((detail) =>
      buildPhysicalCountDetailRow(detail, adjustmentDetailPool, warnings));
    const classifiedDetails = detailRows.filter((detail) => detail.clasificacion);
    const itemsWithDifference = classifiedDetails.filter(
      (detail) => detail.clasificacion !== "SIN_DIFERENCIA",
    );

    rows.push({
      count_id: Number(stockCount.conteo_fisico_id || 0),
      fecha: safeIsoDate(stockCount.fecha_conteo),
      ubicacion: mapLocationSummary(stockCount.location),
      responsable: mapUserSummary(stockCount.performed_by),
      observaciones: stockCount.observaciones || null,
      items_contados: detailRows.length,
      items_con_diferencia: itemsWithDifference.length,
      sobrantes: classifiedDetails.filter((detail) => detail.clasificacion === "SOBRANTE").length,
      faltantes: classifiedDetails.filter((detail) => detail.clasificacion === "FALTANTE").length,
      sin_diferencia: classifiedDetails.filter(
        (detail) => detail.clasificacion === "SIN_DIFERENCIA",
      ).length,
      adjustments_total: linkedAdjustments.length,
      adjustments: linkedAdjustments.map((adjustment) => ({
        adjustment_id: Number(adjustment.ajuste_inventario_id || 0),
        fecha: safeIsoDate(adjustment.fecha_ajuste),
        estado: adjustment.estado || "",
        motivo: adjustment.motivo || "",
      })),
      details_total: detailRows.length,
      details_truncated: detailRows.length > COUNT_DETAIL_PREVIEW_LIMIT,
      detalles: detailRows.slice(0, COUNT_DETAIL_PREVIEW_LIMIT),
      all_details: detailRows,
    });
  }

  return {
    rows,
    warning_details: Array.from(warnings.values()),
  };
}

function buildMovementReferenceMap(movementRows = []) {
  const map = new Map();

  for (const movement of movementRows) {
    const adjustmentId = Number(movement.referencia_id || 0);
    if (!adjustmentId) continue;

    const bucket = map.get(adjustmentId) || [];
    bucket.push(Number(movement.movimiento_id || 0));
    map.set(adjustmentId, bucket);
  }

  return map;
}

function buildAdjustmentRows(adjustments, movementIdsByAdjustment) {
  const warnings = new Map();
  const rows = [];

  for (const adjustment of adjustments || []) {
    const detailRows = (adjustment.inventory_adjustment_detail || []).map((detail) => {
      const impact = resolveAdjustmentImpact(detail);

      if (impact.appliedDifference !== impact.derivedDifference) {
        pushStructuredWarning(warnings, {
          code: "ADJUSTMENT_DIFFERENCE_MISMATCH",
          message:
            "Existen detalles de ajuste cuya diferencia persistida no coincide con la derivada desde cantidad_antes y cantidad_contada.",
        });
      }

      if (!detail.item) {
        pushStructuredWarning(warnings, {
          code: "ADJUSTMENT_DETAIL_ITEM_UNRESOLVED",
          message: "Existen detalles de ajuste sin item resoluble.",
        });
      }

      if (!detail.item?.unidad_medida) {
        pushStructuredWarning(warnings, {
          code: "ADJUSTMENT_DETAIL_UNIT_UNRESOLVED",
          message: "Existen detalles de ajuste sin unidad de medida resoluble.",
        });
      }

      return {
        detail_id: Number(detail.ajuste_detalle_id || 0),
        item: mapItemSummary(detail.item),
        categoria: mapCategorySummary(detail.item),
        unidad: mapUnitSummary(detail.item),
        existencia_id: detail.existence?.existencia_id
          ? Number(detail.existence.existencia_id)
          : null,
        cantidad_anterior: impact.previousQuantity,
        cantidad_ajustada: impact.quantity,
        cantidad_posterior: impact.nextQuantity,
        impacto: impact.impact,
        diferencia_aplicada: impact.appliedDifference,
        tipo_ajuste: detail.tipo_ajuste || null,
      };
    });

    const movementIds = movementIdsByAdjustment.get(
      Number(adjustment.ajuste_inventario_id),
    ) || [];

    if (adjustment.estado === "APLICADO" && movementIds.length === 0) {
      pushStructuredWarning(warnings, {
        code: "ADJUSTMENT_APPLIED_WITHOUT_MOVEMENT",
        message: "Existen ajustes aplicados sin movimiento AJUSTE asociado.",
      });
    }

    rows.push({
      adjustment_id: Number(adjustment.ajuste_inventario_id || 0),
      fecha: safeIsoDate(adjustment.fecha_ajuste),
      estado: adjustment.estado || "",
      motivo: adjustment.motivo || "",
      observaciones: adjustment.observaciones || null,
      ubicacion: mapLocationSummary(adjustment.location),
      responsable: mapUserSummary(adjustment.performed_by),
      conteo_origen: adjustment.stock_count
        ? {
            id: Number(adjustment.stock_count.conteo_fisico_id || 0),
            fecha: safeIsoDate(adjustment.stock_count.fecha_conteo),
          }
        : null,
      items_ajustados: detailRows.length,
      incrementos: detailRows.filter((detail) => detail.impacto === "INCREMENTO").length,
      disminuciones: detailRows.filter((detail) => detail.impacto === "DISMINUCION").length,
      movements_total: movementIds.length,
      movement_ids: movementIds,
      details_total: detailRows.length,
      details_truncated: detailRows.length > ADJUSTMENT_DETAIL_PREVIEW_LIMIT,
      detalles: detailRows.slice(0, ADJUSTMENT_DETAIL_PREVIEW_LIMIT),
      all_details: detailRows,
    });
  }

  return {
    rows,
    warning_details: Array.from(warnings.values()),
  };
}

function aggregateSignedTotalsByUnit(detailRows = [], valueAccessor) {
  const buckets = new Map();

  for (const detail of detailRows) {
    if (!detail.unidad?.id) continue;
    const key = Number(detail.unidad.id);
    const current = buckets.get(key) || {
      unidad_id: key,
      unidad_nombre: detail.unidad.nombre || "",
      total: 0,
    };
    current.total = Number((current.total + valueAccessor(detail)).toFixed(2));
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).sort((left, right) =>
    left.unidad_nombre.localeCompare(right.unidad_nombre, "es"));
}

function summarizeCountRows(rows = []) {
  const allDetails = rows.flatMap((row) => row.all_details || row.detalles || []);

  return {
    total: rows.length,
    por_estado: {},
    items_contados: rows.reduce((acc, row) => acc + row.items_contados, 0),
    items_con_diferencia: rows.reduce((acc, row) => acc + row.items_con_diferencia, 0),
    sobrantes: rows.reduce((acc, row) => acc + row.sobrantes, 0),
    faltantes: rows.reduce((acc, row) => acc + row.faltantes, 0),
    sin_diferencia: rows.reduce((acc, row) => acc + row.sin_diferencia, 0),
    con_ajuste: rows.filter((row) => row.adjustments_total > 0).length,
    sin_ajuste: rows.filter((row) => row.adjustments_total === 0).length,
    calidad_datos: {
      historicos_confirmados: allDetails.filter(
        (detail) => detail.data_quality === "HISTORICO_CONFIRMADO",
      ).length,
      derivados_actuales: allDetails.filter(
        (detail) => detail.data_quality === "DERIVADO_DESDE_EXISTENCIA_ACTUAL",
      ).length,
      no_resolubles: allDetails.filter(
        (detail) => detail.data_quality === "NO_RESOLUBLE",
      ).length,
    },
    diferencias_por_unidad: aggregateSignedTotalsByUnit(
      allDetails,
      (detail) => detail.diferencia || 0,
    ),
  };
}

function summarizeAdjustmentRows(rows = []) {
  const allDetails = rows.flatMap((row) => row.all_details || row.detalles || []);
  const byState = {};
  for (const row of rows) {
    byState[row.estado || "SIN_ESTADO"] = (byState[row.estado || "SIN_ESTADO"] || 0) + 1;
  }

  return {
    total: rows.length,
    por_estado: byState,
    items_ajustados: rows.reduce((acc, row) => acc + row.items_ajustados, 0),
    incrementos: rows.reduce((acc, row) => acc + row.incrementos, 0),
    disminuciones: rows.reduce((acc, row) => acc + row.disminuciones, 0),
    vinculados_a_conteo: rows.filter((row) => row.conteo_origen).length,
    independientes: rows.filter((row) => !row.conteo_origen).length,
    ajustes_por_unidad: aggregateSignedTotalsByUnit(
      allDetails,
      (detail) => detail.diferencia_aplicada || 0,
    ),
  };
}

function filterCountRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.con_diferencias === true && row.items_con_diferencia <= 0) {
      return false;
    }

    if (filters.con_diferencias === false && row.items_con_diferencia > 0) {
      return false;
    }

    if (filters.con_ajuste === true && row.adjustments_total <= 0) {
      return false;
    }

    if (filters.con_ajuste === false && row.adjustments_total > 0) {
      return false;
    }

    if (
      filters.clasificacion_diferencia
      && !(row.all_details || row.detalles).some(
        (detail) => detail.clasificacion === filters.clasificacion_diferencia,
      )
    ) {
      return false;
    }

    if (
      filters.ajuste_tipo
      && !(row.all_details || row.detalles).some((detail) =>
        detail.clasificacion
        === (filters.ajuste_tipo === "POSITIVO" ? "SOBRANTE" : "FALTANTE"))
    ) {
      return false;
    }

    return true;
  });
}

function filterAdjustmentRows(rows, filters) {
  return rows.filter((row) => {
    if (filters.estado_ajuste && row.estado !== filters.estado_ajuste) {
      return false;
    }

    if (filters.con_ajuste === true && !row.conteo_origen) {
      return false;
    }

    if (filters.con_ajuste === false && row.conteo_origen) {
      return false;
    }

    if (
      filters.clasificacion_diferencia
      && !(row.all_details || row.detalles).some((detail) =>
        (filters.clasificacion_diferencia === "SOBRANTE" && detail.impacto === "INCREMENTO")
        || (filters.clasificacion_diferencia === "FALTANTE" && detail.impacto === "DISMINUCION")
        || (filters.clasificacion_diferencia === "SIN_DIFERENCIA" && detail.diferencia_aplicada === 0))
    ) {
      return false;
    }

    if (
      filters.ajuste_tipo
      && !(row.all_details || row.detalles).some(
        (detail) => detail.tipo_ajuste === filters.ajuste_tipo,
      )
    ) {
      return false;
    }

    return true;
  });
}

function paginateRows(rows, page, limit) {
  const start = (page - 1) * limit;
  return rows.slice(start, start + limit);
}

function buildFiltersSnapshot(filters, range, page, limit) {
  return {
    fecha_desde: range.normalized.fecha_desde,
    fecha_hasta: range.normalized.fecha_hasta,
    time_zone: range.normalized.time_zone,
    ubicacion_id: filters.ubicacion_id ? Number(filters.ubicacion_id) : null,
    item_id: filters.item_id ? Number(filters.item_id) : null,
    categoria_id: filters.categoria_id ? Number(filters.categoria_id) : null,
    responsable_id: filters.responsable_id ? Number(filters.responsable_id) : null,
    estado_ajuste: filters.estado_ajuste || null,
    con_diferencias: filters.con_diferencias ?? null,
    clasificacion_diferencia: filters.clasificacion_diferencia || null,
    con_ajuste: filters.con_ajuste ?? null,
    ajuste_tipo: filters.ajuste_tipo || null,
    search: filters.search || null,
    page,
    limit,
  };
}

function buildCountsAdjustmentsReportResponse({
  generatedBy,
  filters,
  summary,
  countRows,
  countPagination,
  adjustmentRows,
  adjustmentPagination,
  warnings,
  warningDetails,
}) {
  return {
    report_type: REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS,
    generated_at: getCurrentChileDateTime().isoInstant,
    generated_timezone: "America/Santiago",
    generated_by: buildReportGeneratedBy(generatedBy),
    filters,
    summary,
    counts: {
      rows: countRows,
      pagination: countPagination,
    },
    adjustments: {
      rows: adjustmentRows,
      pagination: adjustmentPagination,
    },
    warning_details: Array.isArray(warningDetails) ? warningDetails : [],
    warnings: Array.from(
      new Set((warnings || []).filter((warning) => typeof warning === "string" && warning.trim())),
    ),
  };
}

function serializeCountRow(row, { includeAllDetails = false } = {}) {
  return {
    count_id: row.count_id,
    fecha: row.fecha,
    ubicacion: row.ubicacion,
    responsable: row.responsable,
    observaciones: row.observaciones,
    items_contados: row.items_contados,
    items_con_diferencia: row.items_con_diferencia,
    sobrantes: row.sobrantes,
    faltantes: row.faltantes,
    sin_diferencia: row.sin_diferencia,
    adjustments_total: row.adjustments_total,
    adjustments: row.adjustments,
    details_total: row.details_total,
    details_truncated: includeAllDetails ? false : row.details_truncated,
    detalles: includeAllDetails ? [...(row.all_details || [])] : [...row.detalles],
  };
}

function serializeAdjustmentRow(row, { includeAllDetails = false } = {}) {
  return {
    adjustment_id: row.adjustment_id,
    fecha: row.fecha,
    estado: row.estado,
    motivo: row.motivo,
    observaciones: row.observaciones,
    ubicacion: row.ubicacion,
    responsable: row.responsable,
    conteo_origen: row.conteo_origen,
    items_ajustados: row.items_ajustados,
    incrementos: row.incrementos,
    disminuciones: row.disminuciones,
    movements_total: row.movements_total,
    movement_ids: row.movement_ids,
    details_total: row.details_total,
    details_truncated: includeAllDetails ? false : row.details_truncated,
    detalles: includeAllDetails ? [...(row.all_details || [])] : [...row.detalles],
  };
}

function applyCountQueryFilters(queryBuilder, filters, range, scope) {
  queryBuilder.andWhere("stockCount.fecha_conteo >= :countFrom", {
    countFrom: range.fromInclusive,
  });
  queryBuilder.andWhere("stockCount.fecha_conteo < :countToExclusive", {
    countToExclusive: range.toExclusive,
  });

  if (scope.mode === "location") {
    queryBuilder.andWhere("location.ubicacion_id = :scopeLocationId", {
      scopeLocationId: Number(scope.userLocationId),
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

  if (filters.categoria_id) {
    queryBuilder.andWhere("category.categoria_item_id = :categoriaId", {
      categoriaId: Number(filters.categoria_id),
    });
  }

  if (filters.responsable_id) {
    queryBuilder.andWhere("performedBy.id_usuario = :responsableId", {
      responsableId: Number(filters.responsable_id),
    });
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("stockCount.observaciones ILIKE :search", { search: pattern })
          .orWhere("location.nombre_ubicacion ILIKE :search", { search: pattern })
          .orWhere("item.nombre ILIKE :search", { search: pattern })
          .orWhere("item.descripcion ILIKE :search", { search: pattern })
          .orWhere("category.nombre_categoria ILIKE :search", { search: pattern })
          .orWhere("performedBy.nombre ILIKE :search", { search: pattern })
          .orWhere("performedBy.apellido ILIKE :search", { search: pattern });
      }),
    );
  }
}

function applyAdjustmentQueryFilters(queryBuilder, filters, range, scope) {
  queryBuilder.andWhere("adjustment.fecha_ajuste >= :adjustmentFrom", {
    adjustmentFrom: range.fromInclusive,
  });
  queryBuilder.andWhere("adjustment.fecha_ajuste < :adjustmentToExclusive", {
    adjustmentToExclusive: range.toExclusive,
  });

  if (scope.mode === "location") {
    queryBuilder.andWhere("location.ubicacion_id = :scopeLocationId", {
      scopeLocationId: Number(scope.userLocationId),
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

  if (filters.categoria_id) {
    queryBuilder.andWhere("category.categoria_item_id = :categoriaId", {
      categoriaId: Number(filters.categoria_id),
    });
  }

  if (filters.responsable_id) {
    queryBuilder.andWhere("performedBy.id_usuario = :responsableId", {
      responsableId: Number(filters.responsable_id),
    });
  }

  if (filters.estado_ajuste) {
    queryBuilder.andWhere("adjustment.estado = :estadoAjuste", {
      estadoAjuste: filters.estado_ajuste,
    });
  }

  if (filters.ajuste_tipo) {
    queryBuilder.andWhere("detail.tipo_ajuste = :tipoAjuste", {
      tipoAjuste: filters.ajuste_tipo,
    });
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    queryBuilder.andWhere(
      new Brackets((subQuery) => {
        subQuery
          .where("adjustment.motivo ILIKE :search", { search: pattern })
          .orWhere("adjustment.observaciones ILIKE :search", { search: pattern })
          .orWhere("location.nombre_ubicacion ILIKE :search", { search: pattern })
          .orWhere("item.nombre ILIKE :search", { search: pattern })
          .orWhere("item.descripcion ILIKE :search", { search: pattern })
          .orWhere("category.nombre_categoria ILIKE :search", { search: pattern })
          .orWhere("performedBy.nombre ILIKE :search", { search: pattern })
          .orWhere("performedBy.apellido ILIKE :search", { search: pattern });
      }),
    );
  }
}

async function loadFilteredStockCounts({
  manager,
  filters,
  range,
  scope,
}) {
  const repository = manager.getRepository(StockCount);
  const queryBuilder = repository
    .createQueryBuilder("stockCount")
    .leftJoinAndSelect("stockCount.location", "location")
    .leftJoinAndSelect("stockCount.performed_by", "performedBy")
    .leftJoinAndSelect("stockCount.details", "detail")
    .leftJoinAndSelect("detail.item", "item")
    .leftJoinAndSelect("item.categoria", "category")
    .leftJoinAndSelect("item.unidad_medida", "unit")
    .leftJoinAndSelect("detail.existence", "existence");

  applyCountQueryFilters(queryBuilder, filters, range, scope);

  queryBuilder
    .orderBy("stockCount.fecha_conteo", "DESC")
    .addOrderBy("stockCount.conteo_fisico_id", "DESC")
    .addOrderBy("detail.conteo_detalle_id", "ASC");

  return queryBuilder.getMany();
}

async function loadFilteredInventoryAdjustments({
  manager,
  filters,
  range,
  scope,
}) {
  const repository = manager.getRepository(InventoryAdjustment);
  const queryBuilder = repository
    .createQueryBuilder("adjustment")
    .leftJoinAndSelect("adjustment.location", "location")
    .leftJoinAndSelect("adjustment.performed_by", "performedBy")
    .leftJoinAndSelect("adjustment.stock_count", "stockCount")
    .leftJoinAndSelect("adjustment.inventory_adjustment_detail", "detail")
    .leftJoinAndSelect("detail.item", "item")
    .leftJoinAndSelect("item.categoria", "category")
    .leftJoinAndSelect("item.unidad_medida", "unit")
    .leftJoinAndSelect("detail.existence", "existence");

  applyAdjustmentQueryFilters(queryBuilder, filters, range, scope);

  queryBuilder
    .orderBy("adjustment.fecha_ajuste", "DESC")
    .addOrderBy("adjustment.ajuste_inventario_id", "DESC")
    .addOrderBy("detail.ajuste_detalle_id", "ASC");

  return queryBuilder.getMany();
}

async function loadAdjustmentMovementRows(manager, adjustmentIds = []) {
  if (!adjustmentIds.length) return [];

  return manager
    .getRepository(InventoryMovement)
    .createQueryBuilder("movement")
    .select("movement.movimiento_id", "movimiento_id")
    .addSelect("movement.referencia_id", "referencia_id")
    .where("movement.referencia_tipo = :referenceType", {
      referenceType: "AJUSTE",
    })
    .andWhere("movement.referencia_id IN (:...adjustmentIds)", {
      adjustmentIds: adjustmentIds.map((id) => Number(id)),
    })
    .orderBy("movement.movimiento_id", "ASC")
    .getRawMany();
}

async function buildInventoryCountsAdjustmentsReportDataset(
  query = {},
  authContext = {},
  dependencies = {},
  options = {},
) {
  const manager = dependencies.manager || AppDataSource.manager;
  const scope = dependencies.scope || await resolveReadScope(manager, authContext);
  const pagination = options.paginate !== false
    ? normalizeReportPagination(query)
    : { page: null, limit: null };
  const range = buildChileReportDateRange({
    fecha_desde: query.fecha_desde,
    fecha_hasta: query.fecha_hasta,
    fieldType: REPORT_FIELD_TYPES.DATE,
    now: dependencies.now || new Date(),
  });

  const normalizedFilters = {
    ubicacion_id: query.ubicacion_id ? Number(query.ubicacion_id) : null,
    item_id: query.item_id ? Number(query.item_id) : null,
    categoria_id: query.categoria_id ? Number(query.categoria_id) : null,
    responsable_id: query.responsable_id ? Number(query.responsable_id) : null,
    estado_ajuste: normalizeUppercaseAllowlist(query.estado_ajuste, [
      "PENDIENTE",
      "APLICADO",
      "CANCELADO",
    ]),
    con_diferencias: normalizeBooleanFilter(query.con_diferencias),
    clasificacion_diferencia: normalizeUppercaseAllowlist(
      query.clasificacion_diferencia,
      PHYSICAL_COUNT_DIFFERENCE_CLASSIFICATIONS,
    ),
    con_ajuste: normalizeBooleanFilter(query.con_ajuste),
    ajuste_tipo: normalizeUppercaseAllowlist(
      query.ajuste_tipo,
      INVENTORY_ADJUSTMENT_REPORT_TYPES,
    ),
    search: normalizeSearch(query.search),
  };

  const stockCounts = typeof dependencies.stockCountsLoader === "function"
    ? await dependencies.stockCountsLoader({
        filters: normalizedFilters,
        range,
        scope,
      })
    : await loadFilteredStockCounts({
        manager,
        filters: normalizedFilters,
        range,
        scope,
      });

  const adjustments = typeof dependencies.adjustmentsLoader === "function"
    ? await dependencies.adjustmentsLoader({
        filters: normalizedFilters,
        range,
        scope,
      })
    : await loadFilteredInventoryAdjustments({
        manager,
        filters: normalizedFilters,
        range,
        scope,
      });

  const movementRows = typeof dependencies.adjustmentMovementLoader === "function"
    ? await dependencies.adjustmentMovementLoader(adjustments)
    : await loadAdjustmentMovementRows(
        manager,
        adjustments.map((adjustment) => Number(adjustment.ajuste_inventario_id)),
      );

  const linkedAdjustmentsByCount = new Map();
  for (const adjustment of adjustments) {
    const countId = adjustment.stock_count?.conteo_fisico_id
      ? Number(adjustment.stock_count.conteo_fisico_id)
      : null;

    if (!countId) continue;
    const bucket = linkedAdjustmentsByCount.get(countId) || [];
    bucket.push(adjustment);
    linkedAdjustmentsByCount.set(countId, bucket);
  }

  const movementIdsByAdjustment = buildMovementReferenceMap(movementRows);
  const countBuildResult = buildCountRows(stockCounts, linkedAdjustmentsByCount);
  const adjustmentBuildResult = buildAdjustmentRows(adjustments, movementIdsByAdjustment);

  const filteredCountRows = filterCountRows(countBuildResult.rows, normalizedFilters);
  const filteredAdjustmentRows = filterAdjustmentRows(adjustmentBuildResult.rows, normalizedFilters);
  const warningDetails = [
    ...countBuildResult.warning_details,
    ...adjustmentBuildResult.warning_details,
  ];

  return {
    report_type: REPORT_TYPES.INVENTORY_COUNTS_ADJUSTMENTS,
    generated_by: authContext.user || null,
    filters: buildFiltersSnapshot(normalizedFilters, range, pagination.page, pagination.limit),
    summary: {
      conteos: summarizeCountRows(filteredCountRows),
      ajustes: summarizeAdjustmentRows(filteredAdjustmentRows),
    },
    count_rows: options.paginate === false
      ? filteredCountRows.map((row) => serializeCountRow(row, { includeAllDetails: true }))
      : paginateRows(filteredCountRows, pagination.page, pagination.limit).map((row) =>
          serializeCountRow(row)),
    count_all_rows: filteredCountRows.map((row) =>
      serializeCountRow(row, { includeAllDetails: true })),
    count_pagination: options.paginate === false
      ? null
      : buildReportPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: filteredCountRows.length,
        }),
    adjustment_rows: options.paginate === false
      ? filteredAdjustmentRows.map((row) => serializeAdjustmentRow(row, { includeAllDetails: true }))
      : paginateRows(filteredAdjustmentRows, pagination.page, pagination.limit).map((row) =>
          serializeAdjustmentRow(row)),
    adjustment_all_rows: filteredAdjustmentRows.map((row) =>
      serializeAdjustmentRow(row, { includeAllDetails: true })),
    adjustment_pagination: options.paginate === false
      ? null
      : buildReportPaginationMeta({
          page: pagination.page,
          limit: pagination.limit,
          total: filteredAdjustmentRows.length,
        }),
    warning_details: warningDetails,
    warnings: warningDetails.map((warning) => warning.message),
    total_rows: filteredCountRows.length + filteredAdjustmentRows.length,
  };
}

export async function getInventoryCountsAdjustmentsReportPreviewService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildInventoryCountsAdjustmentsReportDataset(
      query,
      authContext,
      dependencies,
      { paginate: true },
    );

    return [
      buildCountsAdjustmentsReportResponse({
        generatedBy: authContext.user || null,
        filters: dataset.filters,
        summary: dataset.summary,
        countRows: dataset.count_rows,
        countPagination: dataset.count_pagination,
        adjustmentRows: dataset.adjustment_rows,
        adjustmentPagination: dataset.adjustment_pagination,
        warningDetails: dataset.warning_details,
        warnings: dataset.warnings,
      }),
      null,
    ];
  } catch (error) {
    console.error("Error al generar preview del informe de conteos y ajustes:", error);
    return [null, error.message || "Error interno al generar el informe de conteos y ajustes"];
  }
}

export async function getInventoryCountsAdjustmentsReportExportService(
  query = {},
  authContext = {},
  dependencies = {},
) {
  try {
    const dataset = await buildInventoryCountsAdjustmentsReportDataset(
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
        warning_details: dataset.warning_details,
        counts: dataset.count_all_rows,
        adjustments: dataset.adjustment_all_rows,
        total_rows: dataset.total_rows,
      },
      null,
    ];
  } catch (error) {
    console.error("Error al generar dataset de exportacion del informe de conteos y ajustes:", error);
    return [null, error.message || "Error interno al generar el informe de conteos y ajustes"];
  }
}

export {
  buildInventoryCountsAdjustmentsReportDataset,
  applyAdjustmentQueryFilters,
  applyCountQueryFilters,
};

"use strict";

function humanizeFallback(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "No disponible";
  }

  const cleaned = normalized.replace(/[_-]+/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const INVENTORY_LABELS = {
  SIN_STOCK: "Sin stock",
  BAJO_MINIMO: "Bajo minimo",
  DISPONIBLE: "Disponible",
  SOBRANTE: "Sobrante",
  FALTANTE: "Faltante",
  SIN_DIFERENCIA: "Sin diferencia",
  PENDIENTE: "Pendiente",
  APLICADO: "Aplicado",
  CANCELADO: "Cancelado",
  HISTORICO_CONFIRMADO: "Historico confirmado",
  DERIVADO_DESDE_EXISTENCIA_ACTUAL: "Derivado desde existencia actual",
  NO_RESOLUBLE: "No resoluble",
  POSITIVO: "Aumento",
  NEGATIVO: "Disminucion",
  INCREMENTO: "Incremento",
  DISMINUCION: "Disminucion",
  BODEGA: "Bodega",
  CLINICA: "Clinica",
  FARMACIA: "Farmacia",
  NUEVO: "Nuevo",
  USADO_BUENO: "Usado en buen estado",
  USADO_MALO: "Usado en mal estado",
  DEFECTUOSO: "Defectuoso",
  true: "Si",
  false: "No",
};

const FILTER_LABELS = {
  categoria_id: "Categoria",
  ubicacion_id: "Ubicacion",
  item_id: "Item",
  unidad_id: "Unidad de medida",
  estado_stock: "Estado del stock",
  solo_sin_stock: "Solo sin stock",
  solo_bajo_minimo: "Solo bajo minimo",
  activo: "Estado del item",
  search: "Busqueda",
  fecha_desde: "Fecha desde",
  fecha_hasta: "Fecha hasta",
  responsable_id: "Responsable",
  estado_ajuste: "Estado del ajuste",
  con_diferencias: "Solo con diferencias",
  clasificacion_diferencia: "Clasificacion de la diferencia",
  con_ajuste: "Solo con ajuste",
  ajuste_tipo: "Tipo de ajuste",
};

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDecimal(value) {
  const number = safeNumber(value);
  if (number === null) {
    return "";
  }

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2,
  }).format(number);
}

function buildInventoryLookups(report = {}) {
  const categoryMap = new Map();
  const locationMap = new Map();
  const itemMap = new Map();
  const unitMap = new Map();
  const responsableMap = new Map();

  for (const row of report.rows || []) {
    if (row.categoria?.id) {
      categoryMap.set(Number(row.categoria.id), row.categoria.nombre || "Registro no disponible");
    }
    if (row.ubicacion?.id) {
      locationMap.set(Number(row.ubicacion.id), row.ubicacion.nombre || "Registro no disponible");
    }
    if (row.item?.id) {
      itemMap.set(Number(row.item.id), row.item.nombre || "Registro no disponible");
    }
    if (row.unidad?.id) {
      unitMap.set(Number(row.unidad.id), row.unidad.nombre || "Registro no disponible");
    }
  }

  for (const row of report.counts || []) {
    if (row.ubicacion?.id) {
      locationMap.set(Number(row.ubicacion.id), row.ubicacion.nombre || "Registro no disponible");
    }
    if (row.responsable?.id) {
      responsableMap.set(
        Number(row.responsable.id),
        [row.responsable.nombre, row.responsable.apellido].filter(Boolean).join(" ").trim()
          || "Registro no disponible",
      );
    }

    for (const detail of row.detalles || []) {
      if (detail.categoria?.id) {
        categoryMap.set(Number(detail.categoria.id), detail.categoria.nombre || "Registro no disponible");
      }
      if (detail.item?.id) {
        itemMap.set(Number(detail.item.id), detail.item.nombre || "Registro no disponible");
      }
      if (detail.unidad?.id) {
        unitMap.set(Number(detail.unidad.id), detail.unidad.nombre || "Registro no disponible");
      }
    }
  }

  for (const row of report.adjustments || []) {
    if (row.ubicacion?.id) {
      locationMap.set(Number(row.ubicacion.id), row.ubicacion.nombre || "Registro no disponible");
    }
    if (row.responsable?.id) {
      responsableMap.set(
        Number(row.responsable.id),
        [row.responsable.nombre, row.responsable.apellido].filter(Boolean).join(" ").trim()
          || "Registro no disponible",
      );
    }

    for (const detail of row.detalles || []) {
      if (detail.categoria?.id) {
        categoryMap.set(Number(detail.categoria.id), detail.categoria.nombre || "Registro no disponible");
      }
      if (detail.item?.id) {
        itemMap.set(Number(detail.item.id), detail.item.nombre || "Registro no disponible");
      }
      if (detail.unidad?.id) {
        unitMap.set(Number(detail.unidad.id), detail.unidad.nombre || "Registro no disponible");
      }
    }
  }

  return {
    categoryMap,
    locationMap,
    itemMap,
    unitMap,
    responsableMap,
  };
}

export function formatInventoryExportLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "No disponible";
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return "No disponible";
  }

  return INVENTORY_LABELS[normalized] || humanizeFallback(normalized);
}

export function formatInventoryFilterLabel(key) {
  return FILTER_LABELS[key] || humanizeFallback(key);
}

export function formatInventoryFilterValue(key, value, report = {}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const lookups = buildInventoryLookups(report);

  if (key === "solo_sin_stock" || key === "solo_bajo_minimo" || key === "con_diferencias" || key === "con_ajuste") {
    return value === true ? "Aplicado" : null;
  }

  if (key === "activo") {
    if (value === true || value === "true") {
      return "Activos";
    }

    if (value === false || value === "false") {
      return "Inactivos";
    }

    return null;
  }

  if (key === "categoria_id") {
    return lookups.categoryMap.get(Number(value)) || "Registro no disponible";
  }

  if (key === "ubicacion_id") {
    return lookups.locationMap.get(Number(value)) || "Registro no disponible";
  }

  if (key === "item_id") {
    return lookups.itemMap.get(Number(value)) || "Registro no disponible";
  }

  if (key === "unidad_id") {
    return lookups.unitMap.get(Number(value)) || "Registro no disponible";
  }

  if (key === "responsable_id") {
    return lookups.responsableMap.get(Number(value)) || "Registro no disponible";
  }

  if (typeof value === "boolean") {
    return formatInventoryExportLabel(String(value));
  }

  return formatInventoryExportLabel(value);
}

export function buildInventoryFilterEntries(filters = {}, report = {}) {
  return Object.entries(filters)
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        return false;
      }

      if (["page", "limit", "time_zone"].includes(key)) {
        return false;
      }

      if (["solo_sin_stock", "solo_bajo_minimo", "con_diferencias", "con_ajuste"].includes(key)) {
        return value === true;
      }

      return true;
    })
    .map(([key, value]) => ({
      label: formatInventoryFilterLabel(key),
      value: formatInventoryFilterValue(key, value, report),
    }))
    .filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== "");
}

export function formatInventoryQuantity(value, unitName = "") {
  const formattedNumber = formatDecimal(value);
  if (!formattedNumber) {
    return "";
  }

  return unitName ? `${formattedNumber} ${unitName}` : formattedNumber;
}

export function buildInventoryExistenceObservationRows(rows = []) {
  const observations = [];

  for (const row of rows || []) {
    const persistenceRows = Number(row.aggregation?.persistence_rows || 1);
    const heterogeneous = Boolean(row.aggregation?.heterogeneous);
    const mixedFields = Array.isArray(row.aggregation?.mixed_fields)
      ? row.aggregation.mixed_fields.map((field) => formatInventoryFilterLabel(field))
      : [];

    if (persistenceRows > 1) {
      observations.push(
        `El item "${row.item?.nombre || "Sin item"}" agrupa ${persistenceRows} registros en la ubicacion "${row.ubicacion?.nombre || "Sin ubicacion"}".`,
      );
    }

    if (heterogeneous && mixedFields.length > 0) {
      observations.push(
        `Los registros agrupados del item "${row.item?.nombre || "Sin item"}" presentan diferencias en ${mixedFields.join(", ")}.`,
      );
    }
  }

  return Array.from(new Set(observations));
}

export function formatInventoryWarningMessage(message) {
  const normalized = String(message || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/item \+ ubicacion/gi, "item y ubicacion")
    .replace(/\bestado\b/gi, "estado")
    .replace(/\bfecha_vencimiento\b/gi, "fecha de vencimiento")
    .replace(/\borigen_tipo\b/gi, "origen")
    .replace(/\bfecha_apertura\b/gi, "fecha de apertura");
}

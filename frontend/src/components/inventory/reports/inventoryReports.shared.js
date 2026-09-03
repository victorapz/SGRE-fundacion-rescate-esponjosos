export const INVENTORY_REPORT_VIEW_IDS = {
  EXISTENCES: "existences",
  COUNTS_ADJUSTMENTS: "counts-adjustments",
};

export const INVENTORY_REPORT_STOCK_STATES = [
  "SIN_STOCK",
  "BAJO_MINIMO",
  "DISPONIBLE",
];

export const INVENTORY_REPORT_ADJUSTMENT_STATES = [
  "PENDIENTE",
  "APLICADO",
  "CANCELADO",
];

export const INVENTORY_REPORT_DIFFERENCE_CLASSIFICATIONS = [
  "SOBRANTE",
  "FALTANTE",
  "SIN_DIFERENCIA",
];

export const INVENTORY_REPORT_ADJUSTMENT_TYPES = [
  "POSITIVO",
  "NEGATIVO",
];

const LABELS = {
  SIN_STOCK: "Sin stock",
  BAJO_MINIMO: "Bajo mínimo",
  DISPONIBLE: "Disponible",
  SOBRANTE: "Sobrante",
  FALTANTE: "Faltante",
  SIN_DIFERENCIA: "Sin diferencia",
  PENDIENTE: "Pendiente",
  APLICADO: "Aplicado",
  CANCELADO: "Cancelado",
  HISTORICO_CONFIRMADO: "Histórico confirmado",
  DERIVADO_DESDE_EXISTENCIA_ACTUAL: "Derivado desde existencia actual",
  NO_RESOLUBLE: "No resoluble",
  POSITIVO: "Aumento",
  NEGATIVO: "Disminucion",
  INCREMENTO: "Incremento",
  DISMINUCION: "Disminucion",
};

function normalizeBooleanLike(value) {
  if (value === true || value === false) {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function buildAllowedInventoryReportViews({
  canReadExistences,
  canReadCountsAdjustments,
}) {
  return [
    {
      id: INVENTORY_REPORT_VIEW_IDS.EXISTENCES,
      label: "Existencias actuales",
      visible: Boolean(canReadExistences),
    },
    {
      id: INVENTORY_REPORT_VIEW_IDS.COUNTS_ADJUSTMENTS,
      label: "Conteos y ajustes",
      visible: Boolean(canReadCountsAdjustments),
    },
  ].filter((view) => view.visible);
}

export function resolveActiveInventoryReportView(activeView, allowedViews) {
  if (allowedViews.some((view) => view.id === activeView)) {
    return activeView;
  }

  return allowedViews[0]?.id || "";
}

export function buildDefaultExistencesReportFilters() {
  return {
    categoria_id: "",
    ubicacion_id: "",
    item_id: "",
    unidad_id: "",
    estado_stock: "",
    solo_sin_stock: false,
    solo_bajo_minimo: false,
    activo: "",
    search: "",
  };
}

export function buildDefaultCountsAdjustmentsReportFilters() {
  return {
    fecha_desde: "",
    fecha_hasta: "",
    ubicacion_id: "",
    item_id: "",
    categoria_id: "",
    responsable_id: "",
    estado_ajuste: "",
    con_diferencias: "",
    clasificacion_diferencia: "",
    con_ajuste: "",
    ajuste_tipo: "",
    search: "",
  };
}

export function normalizeExistencesReportFilters(filters = {}) {
  return {
    categoria_id: normalizeString(filters.categoria_id),
    ubicacion_id: normalizeString(filters.ubicacion_id),
    item_id: normalizeString(filters.item_id),
    unidad_id: normalizeString(filters.unidad_id),
    estado_stock: normalizeString(filters.estado_stock).toUpperCase(),
    solo_sin_stock: Boolean(filters.solo_sin_stock),
    solo_bajo_minimo: Boolean(filters.solo_bajo_minimo),
    activo: normalizeBooleanLike(filters.activo),
    search: normalizeString(filters.search),
  };
}

export function normalizeCountsAdjustmentsReportFilters(filters = {}) {
  return {
    fecha_desde: normalizeString(filters.fecha_desde),
    fecha_hasta: normalizeString(filters.fecha_hasta),
    ubicacion_id: normalizeString(filters.ubicacion_id),
    item_id: normalizeString(filters.item_id),
    categoria_id: normalizeString(filters.categoria_id),
    responsable_id: normalizeString(filters.responsable_id),
    estado_ajuste: normalizeString(filters.estado_ajuste).toUpperCase(),
    con_diferencias: normalizeBooleanLike(filters.con_diferencias),
    clasificacion_diferencia: normalizeString(filters.clasificacion_diferencia).toUpperCase(),
    con_ajuste: normalizeBooleanLike(filters.con_ajuste),
    ajuste_tipo: normalizeString(filters.ajuste_tipo).toUpperCase(),
    search: normalizeString(filters.search),
  };
}

export function validateExistencesReportFilters(filters = {}) {
  const normalized = normalizeExistencesReportFilters(filters);

  if (normalized.solo_sin_stock && normalized.solo_bajo_minimo) {
    return "No puedes combinar Solo sin stock con Solo bajo mínimo.";
  }

  if (
    normalized.estado_stock
    && normalized.solo_sin_stock
    && normalized.estado_stock !== "SIN_STOCK"
  ) {
    return "Solo sin stock entra en conflicto con el estado del stock seleccionado.";
  }

  if (
    normalized.estado_stock
    && normalized.solo_bajo_minimo
    && normalized.estado_stock !== "BAJO_MINIMO"
  ) {
    return "Solo bajo mínimo entra en conflicto con el estado del stock seleccionado.";
  }

  return "";
}

export function validateCountsAdjustmentsReportFilters(filters = {}) {
  const normalized = normalizeCountsAdjustmentsReportFilters(filters);

  if (
    normalized.fecha_desde
    && normalized.fecha_hasta
    && normalized.fecha_desde > normalized.fecha_hasta
  ) {
    return "La fecha desde no puede ser posterior a la fecha hasta.";
  }

  if (
    normalized.clasificacion_diferencia === "SIN_DIFERENCIA"
    && normalized.ajuste_tipo
  ) {
    return "Sin diferencia entra en conflicto con el tipo de ajuste.";
  }

  if (
    normalized.con_diferencias === false
    && normalized.clasificacion_diferencia
    && normalized.clasificacion_diferencia !== "SIN_DIFERENCIA"
  ) {
    return "No puedes pedir solo registros sin diferencias y filtrar por sobrante o faltante al mismo tiempo.";
  }

  return "";
}

export function formatInventoryReportLabel(value) {
  if (!value) {
    return "Sin dato";
  }

  return LABELS[value] || String(value);
}

export function formatInventoryReportDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function formatInventoryReportQuantity(value, unitName = "") {
  if (value === null || value === undefined || value === "") {
    return "Sin dato";
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "Sin dato";
  }

  const formatter = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
  });
  const normalizedUnit = normalizeString(unitName);

  if (!normalizedUnit) {
    return formatter.format(numericValue);
  }

  return `${formatter.format(numericValue)} ${normalizedUnit}`;
}

export function formatInventoryReportPerson(person) {
  if (!person) {
    return "Sin responsable";
  }

  const fullName = [person.nombre, person.apellido].filter(Boolean).join(" ").trim();
  return fullName || person.email || "Sin responsable";
}

export function getInventoryStockTone(value) {
  if (value === "SIN_STOCK") {
    return "danger";
  }

  if (value === "BAJO_MINIMO") {
    return "warning";
  }

  return "success";
}

export function getInventoryAdjustmentStateTone(value) {
  if (value === "CANCELADO") {
    return "neutral";
  }

  if (value === "APLICADO") {
    return "success";
  }

  return "warning";
}

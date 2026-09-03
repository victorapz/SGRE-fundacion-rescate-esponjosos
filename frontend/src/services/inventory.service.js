import api from "../api/axios";
import {
  buildError,
  extractData,
  normalizeInventoryAdjustment,
  normalizeDonationItem,
  normalizeInventoryExistence,
  normalizeInventoryMovement,
  normalizeInventoryItem,
  normalizePurchaseDetail,
  getDetail,
} from "./inventory.shared";

const INVENTORY_BASE_PATH = "/inventory";

function normalizeInventorySummaryRow(item = {}) {
  const inventoryItem = normalizeInventoryItem(item.item);

  return {
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    itemNombre: inventoryItem?.nombre || "",
    categoriaNombre: inventoryItem?.categoriaNombre || "",
    unidadMedidaNombre: inventoryItem?.unidadMedidaNombre || "",
    cantidadTotal: Number(item.cantidad_total || 0),
    numeroUbicaciones: Number(item.numero_ubicaciones || 0),
    stockMinimo: item.stock_minimo === null || item.stock_minimo === undefined
      ? null
      : Number(item.stock_minimo),
    estadoStock: item.estado_stock || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
  };
}

function normalizeInventoryDetail(item = {}) {
  const inventoryItem = normalizeInventoryItem(item.item);

  return {
    item: inventoryItem,
    itemId: inventoryItem?.id || "",
    cantidadTotal: Number(item.cantidad_total || 0),
    stockMinimo: item.stock_minimo === null || item.stock_minimo === undefined
      ? null
      : Number(item.stock_minimo),
    estadoStock: item.estado_stock || "",
    alertas: Array.isArray(item.alertas) ? item.alertas : [],
    existencias: Array.isArray(item.existencias)
      ? item.existencias.map(normalizeInventoryExistence)
      : [],
    distribucionPorUbicacion: Array.isArray(item.distribucion_por_ubicacion)
      ? item.distribucion_por_ubicacion.map((entry) => ({
          location: entry.location,
          cantidadTotal: Number(entry.cantidad_total || 0),
          existencias: Number(entry.existencias || 0),
        }))
      : [],
    movimientosRecientes: Array.isArray(item.movimientos_recientes)
      ? item.movimientos_recientes.map(normalizeInventoryMovement)
      : [],
    donacionesAsociadas: Array.isArray(item.donaciones_asociadas)
      ? item.donaciones_asociadas.map(normalizeDonationItem)
      : [],
    comprasAsociadas: Array.isArray(item.compras_asociadas)
      ? item.compras_asociadas.map(normalizePurchaseDetail)
      : [],
  };
}

function normalizeOperationResult(item = {}) {
  return {
    existence: item.existence ? normalizeInventoryExistence(item.existence) : null,
    movement: item.movement ? normalizeInventoryMovement(item.movement) : null,
    sourceExistence: item.source_existence
      ? normalizeInventoryExistence(item.source_existence)
      : null,
    destinationExistence: item.destination_existence
      ? normalizeInventoryExistence(item.destination_existence)
      : null,
    affectedExistences: Array.isArray(item.affected_existences)
      ? item.affected_existences.map(normalizeInventoryExistence)
      : [],
    adjustment: item.adjustment ? normalizeInventoryAdjustment(item.adjustment) : null,
  };
}

export async function getInventorySummary(params = {}) {
  try {
    const response = await api.get(`${INVENTORY_BASE_PATH}/summary`, { params });
    const data = extractData(response);
    return Array.isArray(data) ? data.map(normalizeInventorySummaryRow) : [];
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }
    throw buildError(error, "No fue posible obtener el resumen de inventario");
  }
}

export async function getInventoryItemDetail(itemId, params = {}) {
  return getDetail(
    `${INVENTORY_BASE_PATH}/item/detail`,
    { item_id: itemId, ...params },
    normalizeInventoryDetail,
    "No fue posible obtener el detalle del item",
  );
}

export async function createInitialInventoryLoad(payload) {
  try {
    const response = await api.post(`${INVENTORY_BASE_PATH}/initial-load`, payload);
    return normalizeOperationResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible registrar la carga inicial");
  }
}

export async function consumeInventory(payload) {
  try {
    const response = await api.post(`${INVENTORY_BASE_PATH}/consume`, payload);
    return normalizeOperationResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible registrar el consumo");
  }
}

export async function exitInventory(payload) {
  try {
    const response = await api.post(`${INVENTORY_BASE_PATH}/exit`, payload);
    return normalizeOperationResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible registrar la salida");
  }
}

export async function transferInventory(payload) {
  try {
    const response = await api.post(`${INVENTORY_BASE_PATH}/transfer`, payload);
    return normalizeOperationResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible registrar el traslado");
  }
}

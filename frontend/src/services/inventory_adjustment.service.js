import api from "../api/axios";
import {
  buildError,
  createRawResource,
  deleteResource,
  extractData,
  getDetail,
  getList,
  normalizeInventoryAdjustment,
  normalizeInventoryExistence,
  normalizeInventoryMovement,
  updateResource,
} from "./inventory.shared";

const INVENTORY_ADJUSTMENT_BASE_PATH = "/inventory_adjustment";

function normalizeAdjustmentApplyResult(item = {}) {
  return {
    adjustment: item.adjustment ? normalizeInventoryAdjustment(item.adjustment) : null,
    movements: Array.isArray(item.movements)
      ? item.movements.map(normalizeInventoryMovement)
      : [],
    affectedExistences: Array.isArray(item.affected_existences)
      ? item.affected_existences.map(normalizeInventoryExistence)
      : [],
  };
}

export async function getInventoryAdjustments(params = {}) {
  return getList(
    INVENTORY_ADJUSTMENT_BASE_PATH,
    params,
    normalizeInventoryAdjustment,
    "No fue posible obtener los ajustes",
  );
}

export async function getInventoryAdjustment(id) {
  return getDetail(
    `${INVENTORY_ADJUSTMENT_BASE_PATH}/detail/`,
    { ajuste_inventario_id: id },
    normalizeInventoryAdjustment,
    "No fue posible obtener el ajuste",
  );
}

export async function createInventoryAdjustment(payload) {
  return createRawResource(
    `${INVENTORY_ADJUSTMENT_BASE_PATH}/create`,
    payload,
    "No fue posible crear el ajuste",
  );
}

export async function createManualInventoryAdjustment(payload) {
  try {
    const response = await api.post(`${INVENTORY_ADJUSTMENT_BASE_PATH}/manual`, payload);
    return normalizeInventoryAdjustment(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el ajuste manual");
  }
}

export async function createAdjustmentFromStockCount(payload) {
  try {
    const response = await api.post(
      `${INVENTORY_ADJUSTMENT_BASE_PATH}/from_stock_count`,
      payload,
    );
    return normalizeInventoryAdjustment(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el ajuste desde el conteo");
  }
}

export async function updateInventoryAdjustment(id, payload) {
  return updateResource(
    `${INVENTORY_ADJUSTMENT_BASE_PATH}/detail/`,
    { ajuste_inventario_id: id },
    payload,
    normalizeInventoryAdjustment,
    "No fue posible actualizar el ajuste",
  );
}

export async function deleteInventoryAdjustment(id) {
  return deleteResource(
    `${INVENTORY_ADJUSTMENT_BASE_PATH}/detail/`,
    { ajuste_inventario_id: id },
    normalizeInventoryAdjustment,
    "No fue posible cancelar el ajuste",
  );
}

export async function applyInventoryAdjustment(id) {
  try {
    const response = await api.post(`${INVENTORY_ADJUSTMENT_BASE_PATH}/apply`, null, {
      params: { ajuste_inventario_id: id },
    });
    return normalizeAdjustmentApplyResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible aplicar el ajuste");
  }
}


import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeStockCount,
  updateResource,
} from "./inventory.shared";

const STOCK_COUNT_BASE_PATH = "/stock_count";

export async function getStockCounts(params = {}) {
  return getList(
    STOCK_COUNT_BASE_PATH,
    params,
    normalizeStockCount,
    "No fue posible obtener los conteos",
  );
}

export async function getStockCount(id) {
  return getDetail(
    `${STOCK_COUNT_BASE_PATH}/detail/`,
    { conteo_fisico_id: id },
    normalizeStockCount,
    "No fue posible obtener el conteo",
  );
}

export async function createStockCount(payload) {
  return createResource(
    `${STOCK_COUNT_BASE_PATH}/create`,
    payload,
    normalizeStockCount,
    "No fue posible crear el conteo",
  );
}

export async function updateStockCount(id, payload) {
  return updateResource(
    `${STOCK_COUNT_BASE_PATH}/detail/`,
    { conteo_fisico_id: id },
    payload,
    normalizeStockCount,
    "No fue posible actualizar el conteo",
  );
}

export async function deleteStockCount(id) {
  return deleteResource(
    `${STOCK_COUNT_BASE_PATH}/detail/`,
    { conteo_fisico_id: id },
    null,
    "No fue posible eliminar el conteo",
  );
}


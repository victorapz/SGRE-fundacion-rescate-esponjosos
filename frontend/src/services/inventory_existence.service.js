import {
  getDetail,
  getList,
  normalizeInventoryExistence,
} from "./inventory.shared";

const INVENTORY_EXISTENCE_BASE_PATH = "/inventory_existence";

export async function getInventoryExistences(params = {}) {
  return getList(
    INVENTORY_EXISTENCE_BASE_PATH,
    params,
    normalizeInventoryExistence,
    "No fue posible obtener las existencias",
  );
}

export async function getInventoryExistence(id) {
  return getDetail(
    `${INVENTORY_EXISTENCE_BASE_PATH}/detail/`,
    { existencia_id: id },
    normalizeInventoryExistence,
    "No fue posible obtener la existencia",
  );
}


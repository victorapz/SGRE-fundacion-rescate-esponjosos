import {
  getDetail,
  getList,
  normalizeInventoryMovement,
} from "./inventory.shared";

const INVENTORY_MOVEMENT_BASE_PATH = "/inventory_movement";

export async function getInventoryMovements(params = {}) {
  return getList(
    INVENTORY_MOVEMENT_BASE_PATH,
    params,
    normalizeInventoryMovement,
    "No fue posible obtener los movimientos",
  );
}

export async function getInventoryMovement(id) {
  return getDetail(
    `${INVENTORY_MOVEMENT_BASE_PATH}/detail/`,
    { movimiento_id: id },
    normalizeInventoryMovement,
    "No fue posible obtener el movimiento",
  );
}


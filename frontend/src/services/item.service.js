import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeInventoryItem,
  updateResource,
} from "./inventory.shared";

const ITEM_BASE_PATH = "/item";

export async function getItems(params = {}) {
  return getList(ITEM_BASE_PATH, params, normalizeInventoryItem, "No fue posible obtener los items");
}

export async function getItem(id) {
  return getDetail(
    `${ITEM_BASE_PATH}/detail/`,
    { item_id: id },
    normalizeInventoryItem,
    "No fue posible obtener el item",
  );
}

export async function createItem(payload) {
  return createResource(
    `${ITEM_BASE_PATH}/create`,
    payload,
    normalizeInventoryItem,
    "No fue posible crear el item",
  );
}

export async function updateItem(id, payload) {
  return updateResource(
    `${ITEM_BASE_PATH}/detail/`,
    { item_id: id },
    payload,
    normalizeInventoryItem,
    "No fue posible actualizar el item",
  );
}

export async function deleteItem(id) {
  return deleteResource(
    `${ITEM_BASE_PATH}/detail/`,
    { item_id: id },
    normalizeInventoryItem,
    "No fue posible desactivar el item",
  );
}


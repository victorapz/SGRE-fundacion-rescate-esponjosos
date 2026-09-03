import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeItemCategory,
  updateResource,
} from "./inventory.shared";

const ITEM_CATEGORY_BASE_PATH = "/item_category";

export async function getItemCategories(params = {}) {
  return getList(
    ITEM_CATEGORY_BASE_PATH,
    params,
    normalizeItemCategory,
    "No fue posible obtener las categorias",
  );
}

export async function getItemCategory(id) {
  return getDetail(
    `${ITEM_CATEGORY_BASE_PATH}/detail/`,
    { categoria_item_id: id },
    normalizeItemCategory,
    "No fue posible obtener la categoria",
  );
}

export async function createItemCategory(payload) {
  return createResource(
    `${ITEM_CATEGORY_BASE_PATH}/create`,
    payload,
    normalizeItemCategory,
    "No fue posible crear la categoria",
  );
}

export async function updateItemCategory(id, payload) {
  return updateResource(
    `${ITEM_CATEGORY_BASE_PATH}/detail/`,
    { categoria_item_id: id },
    payload,
    normalizeItemCategory,
    "No fue posible actualizar la categoria",
  );
}

export async function deleteItemCategory(id) {
  return deleteResource(
    `${ITEM_CATEGORY_BASE_PATH}/detail/`,
    { categoria_item_id: id },
    normalizeItemCategory,
    "No fue posible eliminar la categoria",
  );
}


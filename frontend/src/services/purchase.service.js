import api from "../api/axios";
import {
  buildError,
  createResource,
  deleteResource,
  extractData,
  getDetail,
  getList,
  normalizePurchase,
  updateResource,
} from "./inventory.shared";

const PURCHASE_BASE_PATH = "/purchase";

export async function getPurchases(params = {}) {
  return getList(
    PURCHASE_BASE_PATH,
    params,
    normalizePurchase,
    "No fue posible obtener las compras",
  );
}

export async function getPurchase(id) {
  return getDetail(
    `${PURCHASE_BASE_PATH}/detail/`,
    { compra_id: id },
    normalizePurchase,
    "No fue posible obtener la compra",
  );
}

export async function createPurchase(payload) {
  return createResource(
    `${PURCHASE_BASE_PATH}/create`,
    payload,
    normalizePurchase,
    "No fue posible crear la compra",
  );
}

export async function updatePurchase(id, payload) {
  return updateResource(
    `${PURCHASE_BASE_PATH}/detail/`,
    { compra_id: id },
    payload,
    normalizePurchase,
    "No fue posible actualizar la compra",
  );
}

export async function deletePurchase(id) {
  return deleteResource(
    `${PURCHASE_BASE_PATH}/detail/`,
    { compra_id: id },
    null,
    "No fue posible eliminar la compra",
  );
}

export async function confirmPurchase(id) {
  try {
    const response = await api.post(`${PURCHASE_BASE_PATH}/${id}/confirm`);
    return normalizePurchase(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible confirmar la compra");
  }
}

export async function revertPurchaseToDraft(id) {
  try {
    const response = await api.post(`${PURCHASE_BASE_PATH}/${id}/revert-draft`);
    return normalizePurchase(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible devolver la compra a borrador");
  }
}

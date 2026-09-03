import api from "../api/axios";
import {
  buildError,
  createResource,
  deleteResource,
  extractData,
  getDetail,
  getList,
  normalizeInventoryReceipt,
  normalizeInventoryExistence,
  normalizeInventoryMovement,
  normalizePurchaseDetail,
  updateResource,
} from "./inventory.shared";

const PURCHASE_DETAIL_BASE_PATH = "/purchase_detail";

function normalizePurchaseReceptionResult(item = {}) {
  return {
    receipt: item.receipt ? normalizeInventoryReceipt(item.receipt) : null,
    purchaseDetail: item.purchase_detail ? normalizePurchaseDetail(item.purchase_detail) : null,
    existence: item.existence ? normalizeInventoryExistence(item.existence) : null,
    movement: item.movement ? normalizeInventoryMovement(item.movement) : null,
  };
}

function normalizePurchaseBulkReceptionResult(item = {}) {
  return {
    batchIdempotencyKey: item.batch_idempotency_key || "",
    sourceType: item.source_type || "PURCHASE",
    parentId: item.parent_id || "",
    processedCount: Number(item.processed_count || 0),
    receipts: Array.isArray(item.receipts)
      ? item.receipts.map(normalizePurchaseReceptionResult)
      : [],
  };
}

export async function getPurchaseDetails(params = {}) {
  return getList(
    PURCHASE_DETAIL_BASE_PATH,
    params,
    normalizePurchaseDetail,
    "No fue posible obtener los detalles de compra",
  );
}

export async function getPurchaseDetail(id) {
  return getDetail(
    `${PURCHASE_DETAIL_BASE_PATH}/detail/`,
    { detalle_compra_id: id },
    normalizePurchaseDetail,
    "No fue posible obtener el detalle de compra",
  );
}

export async function createPurchaseDetail(payload) {
  return createResource(
    `${PURCHASE_DETAIL_BASE_PATH}/create`,
    payload,
    normalizePurchaseDetail,
    "No fue posible crear el detalle de compra",
  );
}

export async function updatePurchaseDetail(id, payload) {
  return updateResource(
    `${PURCHASE_DETAIL_BASE_PATH}/detail/`,
    { detalle_compra_id: id },
    payload,
    normalizePurchaseDetail,
    "No fue posible actualizar el detalle de compra",
  );
}

export async function deletePurchaseDetail(id) {
  return deleteResource(
    `${PURCHASE_DETAIL_BASE_PATH}/detail/`,
    { detalle_compra_id: id },
    null,
    "No fue posible eliminar el detalle de compra",
  );
}

export async function receivePurchaseDetail(payload) {
  try {
    const response = await api.post(`${PURCHASE_DETAIL_BASE_PATH}/receive`, payload);
    return normalizePurchaseReceptionResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible recepcionar el detalle de compra");
  }
}

export async function receivePurchaseDetailsBulk(payload) {
  try {
    const response = await api.post(`${PURCHASE_DETAIL_BASE_PATH}/receive-bulk`, payload);
    return normalizePurchaseBulkReceptionResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible recepcionar los detalles de compra");
  }
}

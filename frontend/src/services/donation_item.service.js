import api from "../api/axios";
import {
  buildError,
  createResource,
  deleteResource,
  extractData,
  getDetail,
  getList,
  normalizeDonationItem,
  normalizeInventoryReceipt,
  normalizeInventoryExistence,
  normalizeInventoryMovement,
  updateResource,
} from "./inventory.shared";

const DONATION_ITEM_BASE_PATH = "/donation_item";

function normalizeDonationReceptionResult(item = {}) {
  return {
    receipt: item.receipt ? normalizeInventoryReceipt(item.receipt) : null,
    donationItem: item.donation_item ? normalizeDonationItem(item.donation_item) : null,
    existence: item.existence ? normalizeInventoryExistence(item.existence) : null,
    movement: item.movement ? normalizeInventoryMovement(item.movement) : null,
  };
}

function normalizeDonationBulkReceptionResult(item = {}) {
  return {
    batchIdempotencyKey: item.batch_idempotency_key || "",
    sourceType: item.source_type || "DONATION",
    parentId: item.parent_id || "",
    processedCount: Number(item.processed_count || 0),
    receipts: Array.isArray(item.receipts)
      ? item.receipts.map(normalizeDonationReceptionResult)
      : [],
  };
}

export async function getDonationItems(params = {}) {
  return getList(
    DONATION_ITEM_BASE_PATH,
    params,
    normalizeDonationItem,
    "No fue posible obtener los items de donacion",
  );
}

export async function getDonationItem(id) {
  return getDetail(
    `${DONATION_ITEM_BASE_PATH}/detail/`,
    { donacion_individual_id: id },
    normalizeDonationItem,
    "No fue posible obtener el item de donacion",
  );
}

export async function createDonationItem(payload) {
  return createResource(
    `${DONATION_ITEM_BASE_PATH}/create`,
    payload,
    normalizeDonationItem,
    "No fue posible crear el item de donacion",
  );
}

export async function updateDonationItem(id, payload) {
  return updateResource(
    `${DONATION_ITEM_BASE_PATH}/detail/`,
    { donacion_individual_id: id },
    payload,
    normalizeDonationItem,
    "No fue posible actualizar el item de donacion",
  );
}

export async function deleteDonationItem(id) {
  return deleteResource(
    `${DONATION_ITEM_BASE_PATH}/detail/`,
    { donacion_individual_id: id },
    null,
    "No fue posible eliminar el item de donacion",
  );
}

export async function receiveDonationItem(payload) {
  try {
    const response = await api.post(`${DONATION_ITEM_BASE_PATH}/receive`, payload);
    return normalizeDonationReceptionResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible recepcionar el item de donacion");
  }
}

export async function receiveDonationItemsBulk(payload) {
  try {
    const response = await api.post(`${DONATION_ITEM_BASE_PATH}/receive-bulk`, payload);
    return normalizeDonationBulkReceptionResult(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible recepcionar los items de donacion");
  }
}

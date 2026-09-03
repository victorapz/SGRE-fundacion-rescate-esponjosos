import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeDonation,
  updateResource,
} from "./inventory.shared";

const DONATION_BASE_PATH = "/donation";

export async function getDonations(params = {}) {
  return getList(
    DONATION_BASE_PATH,
    params,
    normalizeDonation,
    "No fue posible obtener las donaciones",
  );
}

export async function getDonation(id) {
  return getDetail(
    `${DONATION_BASE_PATH}/detail/`,
    { donacion_id: id },
    normalizeDonation,
    "No fue posible obtener la donacion",
  );
}

export async function createDonation(payload) {
  return createResource(
    `${DONATION_BASE_PATH}/create`,
    payload,
    normalizeDonation,
    "No fue posible crear la donacion",
  );
}

export async function updateDonation(id, payload) {
  return updateResource(
    `${DONATION_BASE_PATH}/detail/`,
    { donacion_id: id },
    payload,
    normalizeDonation,
    "No fue posible actualizar la donacion",
  );
}

export async function deleteDonation(id) {
  return deleteResource(
    `${DONATION_BASE_PATH}/detail/`,
    { donacion_id: id },
    null,
    "No fue posible eliminar la donacion",
  );
}


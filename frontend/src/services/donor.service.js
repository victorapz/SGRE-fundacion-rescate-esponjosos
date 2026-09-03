import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeDonor,
  updateResource,
} from "./inventory.shared";

const DONOR_BASE_PATH = "/donor";

export async function getDonors(params = {}) {
  return getList(
    DONOR_BASE_PATH,
    params,
    normalizeDonor,
    "No fue posible obtener los donantes",
  );
}

export async function getDonor(id) {
  return getDetail(
    `${DONOR_BASE_PATH}/detail/`,
    { donante_id: id },
    normalizeDonor,
    "No fue posible obtener el donante",
  );
}

export async function createDonor(payload) {
  return createResource(
    `${DONOR_BASE_PATH}/create`,
    payload,
    normalizeDonor,
    "No fue posible crear el donante",
  );
}

export async function updateDonor(id, payload) {
  return updateResource(
    `${DONOR_BASE_PATH}/detail/`,
    { donante_id: id },
    payload,
    normalizeDonor,
    "No fue posible actualizar el donante",
  );
}

export async function deleteDonor(id) {
  return deleteResource(
    `${DONOR_BASE_PATH}/detail/`,
    { donante_id: id },
    normalizeDonor,
    "No fue posible eliminar el donante",
  );
}

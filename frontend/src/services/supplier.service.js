import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeSupplier,
  updateResource,
} from "./inventory.shared";

const SUPPLIER_BASE_PATH = "/supplier";

export async function getSuppliers(params = {}) {
  return getList(
    SUPPLIER_BASE_PATH,
    params,
    normalizeSupplier,
    "No fue posible obtener los proveedores",
  );
}

export async function getSupplier(id) {
  return getDetail(
    `${SUPPLIER_BASE_PATH}/detail/`,
    { proveedor_id: id },
    normalizeSupplier,
    "No fue posible obtener el proveedor",
  );
}

export async function createSupplier(payload) {
  return createResource(
    `${SUPPLIER_BASE_PATH}/create`,
    payload,
    normalizeSupplier,
    "No fue posible crear el proveedor",
  );
}

export async function updateSupplier(id, payload) {
  return updateResource(
    `${SUPPLIER_BASE_PATH}/detail/`,
    { proveedor_id: id },
    payload,
    normalizeSupplier,
    "No fue posible actualizar el proveedor",
  );
}

export async function deleteSupplier(id) {
  return deleteResource(
    `${SUPPLIER_BASE_PATH}/detail/`,
    { proveedor_id: id },
    normalizeSupplier,
    "No fue posible desactivar el proveedor",
  );
}


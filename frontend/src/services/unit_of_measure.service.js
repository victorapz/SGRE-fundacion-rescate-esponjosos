import {
  createResource,
  deleteResource,
  getDetail,
  getList,
  normalizeUnitOfMeasure,
  updateResource,
} from "./inventory.shared";

const UNIT_OF_MEASURE_BASE_PATH = "/unit_of_measure";

export async function getUnitsOfMeasure(params = {}) {
  return getList(
    UNIT_OF_MEASURE_BASE_PATH,
    params,
    normalizeUnitOfMeasure,
    "No fue posible obtener las unidades",
  );
}

export async function getUnitOfMeasure(id) {
  return getDetail(
    `${UNIT_OF_MEASURE_BASE_PATH}/detail/`,
    { unidad_medida_id: id },
    normalizeUnitOfMeasure,
    "No fue posible obtener la unidad",
  );
}

export async function createUnitOfMeasure(payload) {
  return createResource(
    `${UNIT_OF_MEASURE_BASE_PATH}/create`,
    payload,
    normalizeUnitOfMeasure,
    "No fue posible crear la unidad",
  );
}

export async function updateUnitOfMeasure(id, payload) {
  return updateResource(
    `${UNIT_OF_MEASURE_BASE_PATH}/detail/`,
    { unidad_medida_id: id },
    payload,
    normalizeUnitOfMeasure,
    "No fue posible actualizar la unidad",
  );
}

export async function deleteUnitOfMeasure(id) {
  return deleteResource(
    `${UNIT_OF_MEASURE_BASE_PATH}/detail/`,
    { unidad_medida_id: id },
    normalizeUnitOfMeasure,
    "No fue posible eliminar la unidad",
  );
}


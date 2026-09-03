import api from "../api/axios";

const FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH = "/foster_home_allowed_animal";

function normalizeAllowedAnimal(item = {}) {
  return {
    id: item.id_allowed_animal || "",
    fosterHomeId: item.foster_home_id || item.foster_home?.id_hogar_temporal || "",
    especie: item.especie || "",
    estadoPermitido: item.estado_permitido || "",
    capacidadMaxima: item.capacidad_maxima ?? null,
    observaciones: item.observaciones || "",
    activo: Boolean(item.activo),
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeAllowedAnimal);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getFosterHomeAllowedAnimals(fosterHomeId) {
  try {
    const response = await api.get(FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH, {
      params: { foster_home_id: fosterHomeId },
    });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las reglas de animales permitidos");
  }
}

export async function getFosterHomeAllowedAnimal(id) {
  try {
    const response = await api.get(`${FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH}/detail`, {
      params: { id },
    });
    return normalizeAllowedAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener la regla de animal permitido");
  }
}

export async function createFosterHomeAllowedAnimal(payload) {
  try {
    const response = await api.post(`${FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH}/create`, payload);
    return normalizeAllowedAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear la regla de animal permitido");
  }
}

export async function updateFosterHomeAllowedAnimal(id, payload) {
  try {
    const response = await api.patch(`${FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeAllowedAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar la regla de animal permitido");
  }
}

export async function deleteFosterHomeAllowedAnimal(id) {
  try {
    const response = await api.delete(`${FOSTER_HOME_ALLOWED_ANIMAL_BASE_PATH}/detail`, {
      params: { id },
    });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar la regla de animal permitido");
  }
}

export { normalizeAllowedAnimal };

import api from "../api/axios";

const FOSTER_HOME_OBSERVATION_BASE_PATH = "/foster_home_observation";

function normalizeFosterHomeObservation(item = {}) {
  return {
    id: item.id_foster_home_observation || "",
    fosterHomeId: item.foster_home_id || "",
    texto: item.texto || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeFosterHomeObservation);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getFosterHomeObservations(fosterHomeId) {
  try {
    const response = await api.get(FOSTER_HOME_OBSERVATION_BASE_PATH, {
      params: { foster_home_id: fosterHomeId },
    });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las observaciones del hogar temporal");
  }
}

export async function createFosterHomeObservation(payload) {
  try {
    const response = await api.post(`${FOSTER_HOME_OBSERVATION_BASE_PATH}/create`, payload);
    return normalizeFosterHomeObservation(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear la observacion del hogar temporal");
  }
}

export async function deleteFosterHomeObservation(id) {
  try {
    const response = await api.delete(`${FOSTER_HOME_OBSERVATION_BASE_PATH}/detail`, {
      params: { id },
    });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar la observacion del hogar temporal");
  }
}

export { normalizeFosterHomeObservation };

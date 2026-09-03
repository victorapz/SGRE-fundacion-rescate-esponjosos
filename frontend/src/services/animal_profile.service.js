import api from "../api/axios";

const PROFILE_BASE_PATH = "/animal_profile";

function normalizeProfile(item = {}) {
  return {
    id: item.id_perfil_animal,
    personalidad: item.personalidad || "",
    gustos: item.gustos || "",
    disgustos: item.disgustos || "",
    historia: item.historia || "",
    cuidadosEspeciales: item.cuidados_especiales || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeProfile);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getAnimalProfiles() {
  try {
    const response = await api.get(PROFILE_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los perfiles");
  }
}

export async function getAnimalProfile(id) {
  try {
    const response = await api.get(`${PROFILE_BASE_PATH}/detail`, { params: { id } });
    return normalizeProfile(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el perfil");
  }
}

export async function createAnimalProfile(payload) {
  try {
    const response = await api.post(`${PROFILE_BASE_PATH}/create`, payload);
    return normalizeProfile(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el perfil");
  }
}

export async function updateAnimalProfile(id, payload) {
  try {
    const response = await api.patch(`${PROFILE_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeProfile(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el perfil");
  }
}

export async function deleteAnimalProfile(id) {
  try {
    const response = await api.delete(`${PROFILE_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el perfil");
  }
}

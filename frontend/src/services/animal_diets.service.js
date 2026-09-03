import api from "../api/axios";

const DIETS_BASE_PATH = "/animal_diets";

function normalizeDiet(item = {}) {
  return {
    id: item.id_animal_dieta,
    marcaAlimento: item.marca_alimento || "",
    horarioAlimentacion: item.horario_alimentacion || "",
    notas: item.notas || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeDiet);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getAnimalDiets() {
  try {
    const response = await api.get(DIETS_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las dietas");
  }
}

export async function getAnimalDiet(id) {
  try {
    const response = await api.get(`${DIETS_BASE_PATH}/detail`, { params: { id } });
    return normalizeDiet(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener la dieta");
  }
}

export async function createAnimalDiet(payload) {
  try {
    const response = await api.post(`${DIETS_BASE_PATH}/create`, payload);
    return normalizeDiet(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear la dieta");
  }
}

export async function updateAnimalDiet(id, payload) {
  try {
    const response = await api.patch(`${DIETS_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeDiet(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar la dieta");
  }
}

export async function deleteAnimalDiet(id) {
  try {
    const response = await api.delete(`${DIETS_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar la dieta");
  }
}

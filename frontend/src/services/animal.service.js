import api from "../api/axios";
import { buildRequestError } from "../utils/requestError";

const ANIMAL_BASE_PATH = "/animal";

function normalizeAnimal(item = {}) {
  return {
    id: item.id_animal,
    nombre: item.nombre || "",
    especie: item.especie || "",
    sexo: item.sexo || "",
    estadoSituacional: item.estado_situacional || "",
    estadoSalud: item.estado_salud_actual || "",
    estadoAdopcion: item.estado_adopcion || "",
    fechaNacimiento: item.fecha_nacimiento || "",
    tipoFechaNacimiento: item.tipo_fecha_nacimiento || (item.fecha_nacimiento ? "ESTIMADA" : "DESCONOCIDA"),
    fechaLlegadaFundacion: item.fecha_llegada_fundacion || "",
    proximoControl: item.proximo_control || "",
    fallecido: Boolean(item.fallecido),
    fechaFallecimiento: item.fecha_fallecimiento || "",
    region: item.region?.nombre || "",
    regionId: item.region?.id_region || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeAnimal);
}

export async function getAnimals() {
  try {
    const response = await api.get(ANIMAL_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener los animales");
  }
}

export async function getAnimal(id) {
  try {
    const response = await api.get(`${ANIMAL_BASE_PATH}/detail`, { params: { id } });
    return normalizeAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener el animal");
  }
}

export async function createAnimal(payload) {
  try {
    const response = await api.post(`${ANIMAL_BASE_PATH}/create`, payload);
    return normalizeAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear el animal");
  }
}

export async function updateAnimal(id, payload) {
  try {
    const response = await api.patch(`${ANIMAL_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeAnimal(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar el animal");
  }
}

export async function deleteAnimal(id) {
  try {
    const response = await api.delete(`${ANIMAL_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildRequestError(error, "No fue posible eliminar el animal");
  }
}

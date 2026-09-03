import api from "../api/axios.js";
import { buildRequestError } from "../utils/requestError.js";

const REGION_BASE_PATH = "/region";

function normalizeRegion(item = {}) {
  return {
    id: item.id_region || "",
    clave: item.clave || item.codigo || "",
    codigo: item.codigo || item.clave || "",
    nombre: item.nombre || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    orden: Number(item.orden || 0),
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeRegion);
}

function extractItem(response) {
  const data = response?.data?.data;
  return data ? normalizeRegion(data) : null;
}

function buildRegionError(error, fallback) {
  return buildRequestError(error, fallback);
}

export async function getRegions(params = {}) {
  try {
    const response = await api.get(REGION_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRegionError(error, "No fue posible obtener las regiones");
  }
}

export async function getRegion(id) {
  try {
    const response = await api.get(`${REGION_BASE_PATH}/${id}`);
    return extractItem(response);
  } catch (error) {
    throw buildRegionError(error, "No fue posible obtener la región");
  }
}

export async function createRegion(payload) {
  try {
    const response = await api.post(REGION_BASE_PATH, payload);
    return extractItem(response);
  } catch (error) {
    throw buildRegionError(error, "No fue posible crear la región");
  }
}

export async function updateRegion(id, payload) {
  try {
    const response = await api.patch(`${REGION_BASE_PATH}/${id}`, payload);
    return extractItem(response);
  } catch (error) {
    throw buildRegionError(error, "No fue posible actualizar la región");
  }
}

export async function toggleRegionActive(id) {
  try {
    const response = await api.patch(`${REGION_BASE_PATH}/${id}/toggle-active`);
    return extractItem(response);
  } catch (error) {
    throw buildRegionError(error, "No fue posible cambiar el estado de la región");
  }
}

export { normalizeRegion };

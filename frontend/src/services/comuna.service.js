import api from "../api/axios.js";
import { buildRequestError } from "../utils/requestError.js";

const COMUNA_BASE_PATH = "/comuna";

function normalizeComuna(item = {}) {
  return {
    id: item.id_comuna || "",
    nombre: item.nombre || "",
    codigo: item.codigo || null,
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    region: item.region
      ? {
          id: item.region.id_region || "",
          clave: item.region.clave || item.region.codigo || "",
          codigo: item.region.codigo || item.region.clave || "",
          nombre: item.region.nombre || "",
          activo: item.region.activo !== undefined ? Boolean(item.region.activo) : true,
          orden: Number(item.region.orden || 0),
        }
      : null,
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeComuna);
}

function extractItem(response) {
  const data = response?.data?.data;
  return data ? normalizeComuna(data) : null;
}

function buildComunaError(error, fallback) {
  return buildRequestError(error, fallback);
}

export async function getComunas(params = {}) {
  try {
    const response = await api.get(COMUNA_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildComunaError(error, "No fue posible obtener las comunas");
  }
}

export async function getComuna(id) {
  try {
    const response = await api.get(`${COMUNA_BASE_PATH}/${id}`);
    return extractItem(response);
  } catch (error) {
    throw buildComunaError(error, "No fue posible obtener la comuna");
  }
}

export async function createComuna(payload) {
  try {
    const response = await api.post(COMUNA_BASE_PATH, payload);
    return extractItem(response);
  } catch (error) {
    throw buildComunaError(error, "No fue posible crear la comuna");
  }
}

export async function updateComuna(id, payload) {
  try {
    const response = await api.patch(`${COMUNA_BASE_PATH}/${id}`, payload);
    return extractItem(response);
  } catch (error) {
    throw buildComunaError(error, "No fue posible actualizar la comuna");
  }
}

export async function toggleComunaActive(id) {
  try {
    const response = await api.patch(`${COMUNA_BASE_PATH}/${id}/toggle-active`);
    return extractItem(response);
  } catch (error) {
    throw buildComunaError(error, "No fue posible cambiar el estado de la comuna");
  }
}

export { normalizeComuna };

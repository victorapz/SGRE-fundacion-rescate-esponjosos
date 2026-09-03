import api from "../api/axios";

const AREA_BASE_PATH = "/area";

function normalizeArea(item = {}) {
  return {
    id: item.id || item.id_area || "",
    id_area: item.id_area || item.id || "",
    nombre: item.nombre || "",
    clave: item.clave || "",
    descripcion: item.descripcion || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

function buildParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export async function getAreas(params = {}) {
  try {
    const response = await api.get(AREA_BASE_PATH, { params: buildParams(params) });
    const data = response?.data?.data;
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(normalizeArea);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las áreas.");
  }
}

export async function getArea(id) {
  try {
    const response = await api.get(`${AREA_BASE_PATH}/${id}`);
    return normalizeArea(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el área.");
  }
}

export async function createArea(payload) {
  try {
    const response = await api.post(AREA_BASE_PATH, payload);
    return normalizeArea(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el área.");
  }
}

export async function updateArea(id, payload) {
  try {
    const response = await api.patch(`${AREA_BASE_PATH}/${id}`, payload);
    return normalizeArea(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el área.");
  }
}

export async function toggleAreaActive(id) {
  try {
    const response = await api.patch(`${AREA_BASE_PATH}/${id}/toggle-active`);
    return normalizeArea(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible cambiar el estado del área.");
  }
}

export { normalizeArea };

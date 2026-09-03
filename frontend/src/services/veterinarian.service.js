import api from "../api/axios.js";
import { buildRequestError } from "../utils/requestError.js";

const VETERINARIAN_BASE_PATH = "/veterinarian";

function normalizeLocation(item = {}) {
  if (!item) return null;

  return {
    id: item.ubicacion_id || "",
    tipo: item.tipo || "",
    nombre: item.nombre_ubicacion || "",
    direccion: item.direccion || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    observaciones: item.observaciones || "",
    region: item.region
      ? {
          id: item.region.id_region || "",
          clave: item.region.clave || "",
          nombre: item.region.nombre || "",
        }
      : null,
    comuna: item.comuna
      ? {
          id: item.comuna.id_comuna || "",
          nombre: item.comuna.nombre || "",
          activo: item.comuna.activo !== undefined ? Boolean(item.comuna.activo) : true,
        }
      : null,
  };
}

function normalizeClinic(item = {}) {
  if (!item) return null;

  return {
    id: item.id_clinica || "",
    nombre: item.nombre || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    location: normalizeLocation(item.location),
  };
}

function normalizeVeterinarian(item = {}) {
  const clinics = Array.isArray(item.clinics)
    ? item.clinics.map(normalizeClinic).filter(Boolean)
    : [];
  const clinic = normalizeClinic(item.clinic) || clinics[0] || null;

  return {
    id: item.id_veterinario || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    email: item.email || "",
    telefono: item.telefono || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    clinic,
    clinics,
    clinicId: clinic?.id || "",
    clinicNombre: clinic?.nombre || "",
    clinicIds: clinics.map((clinicItem) => clinicItem.id),
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeVeterinarian);
}

export async function getVeterinarians(params = {}) {
  try {
    const response = await api.get(VETERINARIAN_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener los veterinarios");
  }
}

export async function getVeterinarian(id) {
  try {
    const response = await api.get(`${VETERINARIAN_BASE_PATH}/detail`, { params: { id } });
    return normalizeVeterinarian(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener el veterinario");
  }
}

export async function createVeterinarian(payload) {
  try {
    const response = await api.post(`${VETERINARIAN_BASE_PATH}/create`, payload);
    return normalizeVeterinarian(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear el veterinario");
  }
}

export async function updateVeterinarian(id, payload) {
  try {
    const response = await api.patch(`${VETERINARIAN_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeVeterinarian(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar el veterinario");
  }
}

export async function deleteVeterinarian(id) {
  try {
    const response = await api.delete(`${VETERINARIAN_BASE_PATH}/detail`, {
      params: { id },
    });
    return normalizeVeterinarian(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible desactivar el veterinario");
  }
}

export { normalizeVeterinarian };

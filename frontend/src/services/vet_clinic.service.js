import api from "../api/axios.js";
import { buildRequestError } from "../utils/requestError.js";

const VET_CLINIC_BASE_PATH = "/vet_clinic";

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

function normalizeVeterinarian(item = {}) {
  return {
    id: item.id_veterinario || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    email: item.email || "",
    telefono: item.telefono || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
  };
}

function normalizeVetClinic(item = {}) {
  const location = normalizeLocation(item.location);
  const veterinarians = Array.isArray(item.veterinarians)
    ? item.veterinarians.map(normalizeVeterinarian)
    : [];

  return {
    id: item.id_clinica || "",
    nombre: item.nombre || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    location,
    locationId: location?.id || "",
    direccion: location?.direccion || "",
    observaciones: location?.observaciones || "",
    region: location?.region || null,
    regionId: location?.region?.id || "",
    comuna: location?.comuna || null,
    comunaId: location?.comuna?.id || "",
    veterinarians,
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeVetClinic);
}

export async function getVetClinics(params = {}) {
  try {
    const response = await api.get(VET_CLINIC_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildRequestError(error, "No fue posible obtener las clinicas");
  }
}

export async function getVetClinic(id) {
  try {
    const response = await api.get(`${VET_CLINIC_BASE_PATH}/detail`, { params: { id } });
    return normalizeVetClinic(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible obtener la clinica");
  }
}

export async function createVetClinic(payload) {
  try {
    const response = await api.post(`${VET_CLINIC_BASE_PATH}/create`, payload);
    return normalizeVetClinic(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible crear la clinica");
  }
}

export async function updateVetClinic(id, payload) {
  try {
    const response = await api.patch(`${VET_CLINIC_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeVetClinic(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible actualizar la clinica");
  }
}

export async function deleteVetClinic(id) {
  try {
    const response = await api.delete(`${VET_CLINIC_BASE_PATH}/detail`, { params: { id } });
    return normalizeVetClinic(response?.data?.data || {});
  } catch (error) {
    throw buildRequestError(error, "No fue posible desactivar la clinica");
  }
}

export { normalizeVetClinic };

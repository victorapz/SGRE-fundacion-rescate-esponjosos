import api from "../api/axios";

const LOCATION_BASE_PATH = "/location";

function normalizeLocation(item = {}) {
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
    label: [
      item.nombre_ubicacion || "",
      item.tipo || "",
      item.comuna?.nombre || "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeLocation);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getLocations(params = {}) {
  try {
    const response = await api.get(LOCATION_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las ubicaciones");
  }
}

export async function getLocation(id) {
  try {
    const response = await api.get(`${LOCATION_BASE_PATH}/detail`, {
      params: { ubicacion_id: id },
    });
    return normalizeLocation(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener la ubicacion");
  }
}

export async function createLocation(payload) {
  try {
    const response = await api.post(`${LOCATION_BASE_PATH}/create`, payload);
    return normalizeLocation(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear la ubicacion");
  }
}

export async function updateLocation(id, payload) {
  try {
    const response = await api.patch(`${LOCATION_BASE_PATH}/detail`, payload, {
      params: { ubicacion_id: id },
    });
    return normalizeLocation(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar la ubicacion");
  }
}

export async function deactivateLocation(id) {
  try {
    const response = await api.delete(`${LOCATION_BASE_PATH}/detail`, {
      params: { ubicacion_id: id },
    });
    return normalizeLocation(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible desactivar la ubicacion");
  }
}

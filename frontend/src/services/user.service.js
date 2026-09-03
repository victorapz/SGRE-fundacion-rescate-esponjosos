import api from "../api/axios";

const USER_BASE_PATH = "/user";

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

function normalizeUser(item) {
  const location = normalizeLocation(item.location);
  const areas = Array.isArray(item.areas)
    ? item.areas.map((area) => ({
        id: area.id_area || "",
        nombre: area.nombre || "",
      }))
    : item.area
      ? [{
          id: item.area.id_area || "",
          nombre: item.area.nombre || "",
        }]
      : [];
  const rolesDetailed = Array.isArray(item.roles)
    ? item.roles.map((role) =>
        typeof role === "string"
          ? { id: "", nombre: role }
          : {
              id: role.id_rol || role.id || "",
              nombre: role.nombre || "",
            },
      )
    : [];
  const roleNames = Array.isArray(item.role_names)
    ? item.role_names
    : rolesDetailed.map((role) => role.nombre).filter(Boolean);

  return {
    id: item.id_usuario,
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    roles: roleNames,
    rolesDetailed,
    email: item.email || "",
    telefono: item.telefono || "",
    areas,
    areaNames: areas.map((area) => area.nombre).filter(Boolean),
    area: areas[0]?.nombre || item.area?.nombre || "",
    areaId: areas[0]?.id || item.area?.id_area || "",
    activo: Boolean(item.activo),
    rut: item.rut || "",
    location,
    locationId: location?.id || "",
    direccion: location?.direccion || "",
    regionId: location?.region?.id || "",
    regionNombre: location?.region?.nombre || "",
    comunaId: location?.comuna?.id || "",
    comunaNombre: location?.comuna?.nombre || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeUser);
}

function buildError(error, fallback) {
  const details = error?.response?.data?.details;
  const message = typeof details === "string"
    ? details
    : error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getUsers() {
  try {
    const response = await api.get(USER_BASE_PATH);
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los usuarios");
  }
}

export async function createUser(payload) {
  try {
    const response = await api.post(`${USER_BASE_PATH}/create`, payload);
    return normalizeUser(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el usuario");
  }
}

export async function getUser(id) {
  try {
    const response = await api.get(`${USER_BASE_PATH}/detail`, {
      params: { id },
    });
    return normalizeUser(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el detalle del usuario");
  }
}

export async function updateUser(id, payload) {
  try {
    const response = await api.patch(`${USER_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeUser(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el usuario");
  }
}

export async function resetUserPassword(id, payload) {
  try {
    const response = await api.patch(`${USER_BASE_PATH}/${id}/password`, payload);
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible restablecer la contrasena del usuario");
  }
}

export async function deleteUser(id) {
  try {
    const response = await api.delete(`${USER_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar el usuario");
  }
}

import api from "../api/axios";

const FOSTER_ASSIGNMENT_BASE_PATH = "/foster_assignment";

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

function normalizeUser(item = {}) {
  if (!item) return null;

  return {
    id: item.id_usuario || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: `${item.nombre || ""} ${item.apellido || ""}`.trim(),
    email: item.email || "",
    telefono: item.telefono || "",
    activo: item.activo !== undefined ? Boolean(item.activo) : true,
    location: normalizeLocation(item.location),
  };
}

function normalizeFosterHomeMember(item = {}) {
  return {
    id: item.id_foster_home_member || "",
    rol: item.rol || "",
    activo: Boolean(item.activo),
    user: normalizeUser(item.user),
  };
}

function normalizeFosterAssignment(item = {}) {
  const responsableUsuario = normalizeUser(item.foster_home?.responsable_usuario);

  return {
    id: item.id_foster_assignment || "",
    animalId: item.animal?.id_animal || item.animal_id || "",
    animal: item.animal
      ? {
          id: item.animal.id_animal || "",
          nombre: item.animal.nombre || "",
          especie: item.animal.especie || "",
          sexo: item.animal.sexo || "",
          estadoSalud: item.animal.estado_salud_actual || "",
          estadoAdopcion: item.animal.estado_adopcion || "",
          fallecido: Boolean(item.animal.fallecido),
        }
      : null,
    hogarTemporalId: item.foster_home?.id_hogar_temporal || item.hogar_temporal_id || "",
    hogarTemporal: item.foster_home
      ? {
          id: item.foster_home.id_hogar_temporal || "",
          responsableUsuario,
          activo: Boolean(item.foster_home.activo),
          miembros: Array.isArray(item.foster_home.miembros)
            ? item.foster_home.miembros.map(normalizeFosterHomeMember)
            : [],
          location: normalizeLocation(item.foster_home.location),
        }
      : null,
    fechaInicio: item.fecha_inicio || "",
    fechaFin: item.fecha_fin || "",
    estado: item.estado || "",
    motivoTermino: item.motivo_termino || "",
    observaciones: item.observaciones || "",
  };
}

function extractItems(response) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeFosterAssignment);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getFosterAssignments(params = {}) {
  try {
    const response = await api.get(FOSTER_ASSIGNMENT_BASE_PATH, { params });
    return extractItems(response);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener las asignaciones");
  }
}

export async function getFosterAssignment(id) {
  try {
    const response = await api.get(`${FOSTER_ASSIGNMENT_BASE_PATH}/detail`, { params: { id } });
    return normalizeFosterAssignment(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener la asignacion");
  }
}

export async function createFosterAssignment(payload) {
  try {
    const response = await api.post(`${FOSTER_ASSIGNMENT_BASE_PATH}/create`, payload);
    return normalizeFosterAssignment(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear la asignacion");
  }
}

export async function updateFosterAssignment(id, payload) {
  try {
    const response = await api.patch(`${FOSTER_ASSIGNMENT_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeFosterAssignment(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar la asignacion");
  }
}

export async function deleteFosterAssignment(id) {
  try {
    const response = await api.delete(`${FOSTER_ASSIGNMENT_BASE_PATH}/detail`, { params: { id } });
    return response?.data?.data || null;
  } catch (error) {
    throw buildError(error, "No fue posible eliminar la asignacion");
  }
}

export { normalizeFosterAssignment };

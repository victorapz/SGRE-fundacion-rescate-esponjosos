import api from "../api/axios";

const FOSTER_HOME_BASE_PATH = "/foster_home";

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
  const user = item.user
    ? normalizeUser(item.user)
    : normalizeUser({
        id_usuario: item.id_usuario,
        nombre: item.nombre,
        apellido: item.apellido,
        email: item.email,
        telefono: item.telefono,
        activo: item.activo,
      });

  return {
    id: item.id_foster_home_member || "",
    rol: item.rol || "",
    activo: Boolean(item.activo),
    user,
  };
}

function normalizeAllowedAnimal(item = {}) {
  return {
    id: item.id_allowed_animal || "",
    especie: item.especie || "",
    estadoPermitido: item.estado_permitido || "",
    capacidadMaxima: item.capacidad_maxima ?? null,
    observaciones: item.observaciones || "",
    activo: Boolean(item.activo),
    fosterHomeId: item.foster_home_id || item.foster_home?.id_hogar_temporal || "",
  };
}

function normalizeFosterHomeObservation(item = {}) {
  return {
    id: item.id_foster_home_observation || "",
    fosterHomeId: item.foster_home_id || "",
    texto: item.texto || "",
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeFosterAssignment(item = {}) {
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
          responsableUsuario: normalizeUser(item.foster_home.responsable_usuario),
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

function normalizeFosterHome(item = {}) {
  const responsableUsuario = normalizeUser(item.responsable_usuario);
  const miembros = Array.isArray(item.miembros)
    ? item.miembros.map(normalizeFosterHomeMember)
    : [];
  const activeAssignments = Array.isArray(item.active_assignments)
    ? item.active_assignments.map(normalizeFosterAssignment)
    : [];
  const assignmentHistory = Array.isArray(item.assignment_history)
    ? item.assignment_history.map(normalizeFosterAssignment)
    : [];
  const location = normalizeLocation(item.location);

  return {
    id: item.id_hogar_temporal || "",
    responsableUsuario,
    responsableUsuarioId: item.responsable_usuario_id || responsableUsuario?.id || "",
    miembros,
    usuariosAsociados: Array.isArray(item.usuarios_asociados)
      ? item.usuarios_asociados.map((id) => Number(id))
      : miembros
          .map((member) => member.user?.id)
          .filter((value) => value !== undefined && value !== null && value !== ""),
    observaciones: item.observaciones || "",
    generalObservaciones: item.observaciones || "",
    activo: Boolean(item.activo),
    location,
    locationId: location?.id || "",
    observationItems: Array.isArray(item.observations)
      ? item.observations.map(normalizeFosterHomeObservation)
      : [],
    allowedAnimals: Array.isArray(item.allowed_animals)
      ? item.allowed_animals.map(normalizeAllowedAnimal)
      : [],
    activeAssignmentsCount: item.active_assignments_count ?? activeAssignments.length ?? 0,
    activeAssignments,
    assignmentHistory,
  };
}

function extractItems(response, normalizer = (item) => item) {
  const data = response?.data?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizer);
}

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  return new Error(message);
}

export async function getFosterHomes() {
  try {
    const response = await api.get(FOSTER_HOME_BASE_PATH);
    return extractItems(response, normalizeFosterHome);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los hogares temporales");
  }
}

export async function getFosterHome(id) {
  try {
    const response = await api.get(`${FOSTER_HOME_BASE_PATH}/detail`, { params: { id } });
    return normalizeFosterHome(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el hogar temporal");
  }
}

export async function getMyFosterHome() {
  try {
    const response = await api.get(`${FOSTER_HOME_BASE_PATH}/my-home`);
    return normalizeFosterHome(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener tu hogar temporal asociado");
  }
}

export async function createFosterHome(payload) {
  try {
    const response = await api.post(`${FOSTER_HOME_BASE_PATH}/create`, payload);
    return normalizeFosterHome(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible crear el hogar temporal");
  }
}

export async function updateFosterHome(id, payload) {
  try {
    const response = await api.patch(`${FOSTER_HOME_BASE_PATH}/detail`, payload, {
      params: { id },
    });
    return normalizeFosterHome(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible actualizar el hogar temporal");
  }
}

export async function deleteFosterHome(id) {
  try {
    const response = await api.delete(`${FOSTER_HOME_BASE_PATH}/detail`, { params: { id } });
    return normalizeFosterHome(response?.data?.data || {});
  } catch (error) {
    throw buildError(error, "No fue posible desactivar el hogar temporal");
  }
}

export async function getEligibleFosterHomeAnimals(id) {
  try {
    const response = await api.get(`${FOSTER_HOME_BASE_PATH}/eligible_animals`, {
      params: { id },
    });
    return extractItems(response, (item) => ({
      id: item.id_animal || "",
      nombre: item.nombre || "",
      especie: item.especie || "",
      sexo: item.sexo || "",
      estadoSalud: item.estado_salud_actual || "",
      estadoAdopcion: item.estado_adopcion || "",
      fallecido: Boolean(item.fallecido),
      compatibility: item.compatibility || null,
    }));
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return [];
    }

    throw buildError(error, "No fue posible obtener los animales elegibles");
  }
}

export {
  normalizeAllowedAnimal,
  normalizeFosterAssignment,
  normalizeFosterHome,
  normalizeFosterHomeMember,
  normalizeFosterHomeObservation,
  normalizeLocation,
  normalizeUser,
};

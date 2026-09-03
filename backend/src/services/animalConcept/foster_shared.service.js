"use strict";

import { Estado } from "../../entities/foster_assignment.entity.js";
import { FosterHomeMemberRole } from "../../entities/foster_home_member.entity.js";
import { AnimalHealthStatusENUM } from "../../entities/foster_home_allowed_animals.js";
import { mapLocationSummary, normalizeNullableString } from "../location.shared.js";

export { normalizeNullableString };

export function serializeAnimalSummary(animal) {
  if (!animal) return null;

  return {
    id_animal: animal.id_animal,
    nombre: animal.nombre || "",
    especie: animal.especie || "",
    sexo: animal.sexo || "",
    estado_salud_actual: animal.estado_salud_actual || "",
    estado_adopcion: animal.estado_adopcion || null,
    fallecido: Boolean(animal.fallecido),
  };
}

export function serializeUserSummary(user) {
  if (!user) return null;

  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    email: user.email || "",
    telefono: user.telefono || "",
    activo: user.activo !== undefined ? Boolean(user.activo) : true,
    location: mapLocationSummary(user.location),
  };
}

export function serializeFosterHomeMember(member) {
  if (!member || !member.user) return null;

  const user = serializeUserSummary(member.user);

  return {
    id_foster_home_member: member.id_foster_home_member,
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    telefono: user.telefono,
    rol: member.rol || FosterHomeMemberRole.MIEMBRO,
    activo: Boolean(member.activo),
    user,
  };
}

export function serializeAllowedAnimal(rule) {
  if (!rule) return null;

  return {
    id_allowed_animal: rule.id_allowed_animal,
    especie: rule.especie || "",
    estado_permitido: rule.estado_permitido || "",
    capacidad_maxima: rule.capacidad_maxima ?? null,
    observaciones: rule.observaciones || null,
    activo: Boolean(rule.activo),
    foster_home_id:
      rule.foster_home?.id_hogar_temporal
      || rule.foster_home_id
      || null,
  };
}

export function serializeFosterHomeObservation(observation) {
  if (!observation) return null;

  return {
    id_foster_home_observation: observation.id_foster_home_observation,
    texto: observation.texto || "",
    createdAt: observation.createdAt || null,
    updatedAt: observation.updatedAt || null,
    foster_home_id:
      observation.foster_home?.id_hogar_temporal
      || observation.foster_home_id
      || null,
  };
}

export function serializeFosterAssignment(assignment) {
  if (!assignment) return null;

  const activeMembers = (assignment.foster_home?.miembros || [])
    .filter((member) => Boolean(member?.activo))
    .map(serializeFosterHomeMember)
    .filter(Boolean);

  return {
    id_foster_assignment: assignment.id_foster_assignment,
    fecha_inicio: assignment.fecha_inicio || null,
    fecha_fin: assignment.fecha_fin || null,
    estado: assignment.estado || "",
    motivo_termino: assignment.motivo_termino || null,
    observaciones: assignment.observaciones || null,
    animal: serializeAnimalSummary(assignment.animal),
    foster_home: assignment.foster_home
      ? {
          id_hogar_temporal: assignment.foster_home.id_hogar_temporal,
          responsable_usuario: serializeUserSummary(
            assignment.foster_home.responsable_usuario,
          ),
          activo: Boolean(assignment.foster_home.activo),
          miembros: activeMembers,
          location: deriveFosterHomeLocation(assignment.foster_home),
        }
      : null,
  };
}

export function getActiveAssignments(assignments = []) {
  return assignments.filter((assignment) => assignment?.estado === Estado.ACTIVO);
}

export function getAssignmentHistory(assignments = []) {
  return assignments.filter(
    (assignment) =>
      assignment?.estado === Estado.FINALIZADO
      || assignment?.estado === Estado.TRASLADADO,
  );
}

export function getActiveAllowedAnimals(allowedAnimals = []) {
  return allowedAnimals.filter((rule) => Boolean(rule?.activo));
}

export function isAllowedAnimalCompatible(rule, animal) {
  if (!rule || !animal || !rule.activo) return false;
  if (rule.especie !== animal.especie) return false;

  return (
    rule.estado_permitido === AnimalHealthStatusENUM.CUALQUIERA
    || rule.estado_permitido === animal.estado_salud_actual
  );
}

export function countAssignmentsForRule(assignments = [], rule, excludedAssignmentId = null) {
  return getActiveAssignments(assignments).filter((assignment) => {
    if (!assignment?.animal) return false;
    if (
      excludedAssignmentId !== null
      && Number(assignment.id_foster_assignment) === Number(excludedAssignmentId)
    ) {
      return false;
    }

    return isAllowedAnimalCompatible(rule, assignment.animal);
  }).length;
}

export function resolveCompatibleRuleForAnimal(
  animal,
  fosterHome,
  excludedAssignmentId = null,
) {
  const activeRules = getActiveAllowedAnimals(fosterHome?.allowed_animals || []);

  if (activeRules.length === 0) {
    return {
      ok: false,
      message: "El hogar temporal no tiene reglas activas de animales permitidos.",
    };
  }

  const compatibleRules = activeRules.filter((rule) =>
    isAllowedAnimalCompatible(rule, animal),
  );

  if (compatibleRules.length === 0) {
    return {
      ok: false,
      message: "El animal no es compatible con las reglas activas del hogar temporal.",
    };
  }

  const activeAssignments = getActiveAssignments(fosterHome?.foster_assignments || []);
  const ruleWithCapacity = compatibleRules.find((rule) => {
    if (rule.capacidad_maxima === null || rule.capacidad_maxima === undefined) {
      return true;
    }

    return (
      countAssignmentsForRule(activeAssignments, rule, excludedAssignmentId)
      < Number(rule.capacidad_maxima)
    );
  });

  if (!ruleWithCapacity) {
    return {
      ok: false,
      message: "La capacidad maxima para las reglas compatibles ya fue alcanzada.",
    };
  }

  return {
    ok: true,
    rule: ruleWithCapacity,
    compatibleRules,
  };
}

export function buildEligibleAnimalPayload(animal, rule, currentAssignments = []) {
  const occupancy = countAssignmentsForRule(currentAssignments, rule);

  return {
    ...serializeAnimalSummary(animal),
    compatibility: {
      especie: rule.especie,
      estado_permitido: rule.estado_permitido,
      capacidad_maxima: rule.capacidad_maxima ?? null,
      current_occupancy: occupancy,
      remaining_capacity:
        rule.capacidad_maxima === null || rule.capacidad_maxima === undefined
          ? null
          : Math.max(Number(rule.capacidad_maxima) - occupancy, 0),
    },
  };
}

export function deriveFosterHomeLocation(home) {
  if (!home) return null;

  const responsibleLocation = home.responsable_usuario?.location;
  if (responsibleLocation) {
    return mapLocationSummary(responsibleLocation);
  }

  const firstMemberLocation = (home.miembros || [])
    .find((member) => Boolean(member?.activo) && member.user?.location)
    ?.user?.location;

  return mapLocationSummary(firstMemberLocation);
}

export function serializeFosterHome(
  home,
  { includeAllAllowedAnimals = false, includeObservations = true } = {},
) {
  if (!home) return null;

  const activeAssignments = getActiveAssignments(home.foster_assignments || []);
  const assignmentHistory = getAssignmentHistory(home.foster_assignments || []);
  const activeMembers = (home.miembros || []).filter((member) => Boolean(member?.activo));
  const responsableUsuario = serializeUserSummary(home.responsable_usuario);
  const location = deriveFosterHomeLocation(home);
  const observations = includeObservations
    ? Array.isArray(home.observations)
      ? [...home.observations]
          .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
          .map(serializeFosterHomeObservation)
          .filter(Boolean)
      : []
    : [];
  const allowedAnimals = includeAllAllowedAnimals
    ? (home.allowed_animals || []).map(serializeAllowedAnimal)
    : getActiveAllowedAnimals(home.allowed_animals || []).map(serializeAllowedAnimal);

  return {
    id_hogar_temporal: home.id_hogar_temporal,
    observaciones: home.observaciones || null,
    activo: Boolean(home.activo),
    responsable_usuario: responsableUsuario,
    responsable_usuario_id: responsableUsuario?.id_usuario || null,
    miembros: activeMembers.map(serializeFosterHomeMember).filter(Boolean),
    usuarios_asociados: activeMembers
      .map((member) => member.user?.id_usuario)
      .filter((value) => value !== undefined && value !== null),
    observations,
    allowed_animals: allowedAnimals,
    active_assignments_count: activeAssignments.length,
    active_assignments: activeAssignments.map(serializeFosterAssignment),
    assignment_history: assignmentHistory.map(serializeFosterAssignment),
    location,
  };
}

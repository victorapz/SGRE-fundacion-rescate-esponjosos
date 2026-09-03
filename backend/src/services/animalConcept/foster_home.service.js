"use strict";

import { In } from "typeorm";
import { AppDataSource } from "../../config/configDb.js";
import Animal from "../../entities/animalConcept/animal.entity.js";
import FosterAssignment, { Estado } from "../../entities/foster_assignment.entity.js";
import FosterHome from "../../entities/foster_home.entity.js";
import FosterHomeAllowedAnimal from "../../entities/foster_home_allowed_animals.js";
import FosterHomeMember, {
  FosterHomeMemberRole,
} from "../../entities/foster_home_member.entity.js";
import User from "../../entities/user.entity.js";
import Location, { LOCATION_TYPES } from "../../entities/inventoryConcept/location.entity.js";
import {
  buildEligibleAnimalPayload,
  normalizeNullableString,
  resolveCompatibleRuleForAnimal,
  serializeAllowedAnimal,
  serializeFosterHome,
} from "./foster_shared.service.js";
import { locationRelations } from "../location.shared.js";

const FOSTER_HOME_OBSERVATION_READ_PERMISSION = "animals:foster_home_observation:read";
const FOSTER_HOME_SCOPED_ROLE = "Hogar Temporal";

function hasDuplicateAllowedAnimalRules(allowedAnimals = []) {
  const activeKeys = new Set();

  for (const item of allowedAnimals) {
    if (item?.activo === false) continue;

    const key = `${item?.especie || ""}::${item?.estado_permitido || ""}`;
    if (activeKeys.has(key)) {
      return true;
    }

    activeKeys.add(key);
  }

  return false;
}

function buildPermissionSet(authContext = {}) {
  const permissions = Array.isArray(authContext.permissions) ? authContext.permissions : [];
  return new Set(permissions);
}

function canReadFosterHomeObservations(authContext = {}) {
  return buildPermissionSet(authContext).has(FOSTER_HOME_OBSERVATION_READ_PERMISSION);
}

async function getUserRoleNames(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return [];
  }

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({
    where: { id_usuario: parsedUserId },
    relations: {
      UserRole: {
        role: true,
      },
    },
  });

  return Array.isArray(user?.UserRole)
    ? user.UserRole.map((userRole) => userRole.role?.nombre).filter(Boolean)
    : [];
}

async function isScopedFosterHomeUser(authContext = {}) {
  const userId = Number(authContext.user?.id_usuario);
  if (!Number.isInteger(userId) || userId <= 0) {
    return false;
  }

  const roleNames = await getUserRoleNames(userId);
  return roleNames.includes(FOSTER_HOME_SCOPED_ROLE);
}

async function getAssociatedFosterHomeIdForUser(userId) {
  const parsedUserId = Number(userId);
  if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
    return null;
  }

  const fosterHomeRepository = AppDataSource.getRepository(FosterHome);
  const fosterHome = await fosterHomeRepository
    .createQueryBuilder("home")
    .leftJoin("home.responsable_usuario", "responsable")
    .leftJoin("home.miembros", "member")
    .leftJoin("member.user", "memberUser")
    .where("responsable.id_usuario = :userId", { userId: parsedUserId })
    .orWhere("(memberUser.id_usuario = :userId AND member.activo = true)", {
      userId: parsedUserId,
    })
    .orderBy("home.activo", "DESC")
    .addOrderBy("home.updatedAt", "DESC")
    .getOne();

  return fosterHome ? Number(fosterHome.id_hogar_temporal) : null;
}

async function ensureScopedFosterHomeAccess(homeId, authContext = {}) {
  if (!(await isScopedFosterHomeUser(authContext))) {
    return [true, null];
  }

  const associatedHomeId = await getAssociatedFosterHomeIdForUser(authContext.user?.id_usuario);
  if (!associatedHomeId) {
    return [false, "No tienes un hogar temporal asociado."];
  }

  if (Number(associatedHomeId) !== Number(homeId)) {
    return [false, "No tienes permisos para acceder a otro hogar temporal."];
  }

  return [true, null];
}

function buildFosterHomeSerializationOptions(authContext = {}, overrides = {}) {
  return {
    includeAllAllowedAnimals: true,
    includeObservations: canReadFosterHomeObservations(authContext),
    ...overrides,
  };
}

async function getFosterHomeWithDetails(id) {
  const fosterHomeRepository = AppDataSource.getRepository(FosterHome);

  return fosterHomeRepository.findOne({
    where: { id_hogar_temporal: Number(id) },
    relations: {
      responsable_usuario: {
        location: locationRelations,
      },
      miembros: {
        user: {
          location: locationRelations,
        },
      },
      observations: true,
      allowed_animals: true,
      foster_assignments: {
        animal: true,
      },
    },
  });
}

async function getUsersByIds(userIds, manager) {
  const userRepository = manager.getRepository(User);
  return userRepository.find({
    where: {
      id_usuario: In(userIds.map((id) => Number(id))),
    },
    relations: {
      location: locationRelations,
    },
  });
}

function ensureUniqueAssociatedUsers(userIds = []) {
  return new Set(userIds.map((id) => Number(id))).size === userIds.length;
}

function getLocationIdFromUsers(users = []) {
  const firstLocationId = users[0]?.location?.ubicacion_id;
  return firstLocationId ? Number(firstLocationId) : null;
}

async function countActiveHomesUsingLocation(manager, locationId, excludingHomeId = null) {
  const query = manager
    .getRepository(FosterHomeMember)
    .createQueryBuilder("member")
    .innerJoin("member.foster_home", "home")
    .innerJoin("member.user", "user")
    .innerJoin("user.location", "location")
    .where("member.activo = true")
    .andWhere("home.activo = true")
    .andWhere("location.ubicacion_id = :locationId", { locationId: Number(locationId) });

  if (excludingHomeId !== null) {
    query.andWhere("home.id_hogar_temporal != :excludingHomeId", {
      excludingHomeId: Number(excludingHomeId),
    });
  }

  return query.getCount();
}

async function syncLocationType(manager, locationIds = []) {
  const locationRepository = manager.getRepository(Location);

  for (const rawLocationId of locationIds) {
    const locationId = Number(rawLocationId);
    if (Number.isNaN(locationId)) continue;

    const location = await locationRepository.findOne({
      where: { ubicacion_id: locationId },
    });

    if (!location) continue;

    const activeHomesUsingLocation = await countActiveHomesUsingLocation(
      manager,
      locationId,
    );

    const nextType =
      activeHomesUsingLocation > 0
        ? LOCATION_TYPES.HOGAR_TEMPORAL
        : LOCATION_TYPES.PERSONA;

    if (location.tipo !== nextType) {
      location.tipo = nextType;
      await locationRepository.save(location);
    }
  }
}

async function validateFosterHomeUsers({
  manager,
  usuariosAsociados,
  responsableUsuarioId,
  currentHomeId = null,
  homeIsActive = true,
}) {
  const normalizedUserIds = Array.isArray(usuariosAsociados)
    ? usuariosAsociados.map((id) => Number(id))
    : [];

  if (normalizedUserIds.length === 0) {
    return {
      ok: false,
      message: "El hogar temporal debe tener al menos un usuario asociado.",
    };
  }

  if (!ensureUniqueAssociatedUsers(normalizedUserIds)) {
    return {
      ok: false,
      message: "No se puede asociar dos veces el mismo usuario al hogar temporal.",
    };
  }

  if (!normalizedUserIds.includes(Number(responsableUsuarioId))) {
    return {
      ok: false,
      message: "El responsable debe estar incluido dentro de los usuarios asociados.",
    };
  }

  const users = await getUsersByIds(normalizedUserIds, manager);
  if (users.length !== normalizedUserIds.length) {
    return {
      ok: false,
      message: "Uno o mas usuarios asociados no existen.",
    };
  }

  const usersWithoutLocation = users.filter((user) => !user.location?.ubicacion_id);
  if (usersWithoutLocation.length > 0) {
    return {
      ok: false,
      message: "Todos los usuarios asociados deben tener una ubicacion asignada.",
    };
  }

  const locationIds = new Set(users.map((user) => Number(user.location?.ubicacion_id)));
  if (locationIds.size !== 1) {
    return {
      ok: false,
      message: "Todos los miembros activos del hogar temporal deben compartir la misma ubicacion.",
    };
  }

  const sharedLocationId = getLocationIdFromUsers(users);

  if (homeIsActive) {
    const activeHomeConflicts = await countActiveHomesUsingLocation(
      manager,
      sharedLocationId,
      currentHomeId,
    );

    if (activeHomeConflicts > 0) {
      return {
        ok: false,
        message: "La ubicacion indicada ya esta asociada a otro hogar temporal activo.",
      };
    }
  }

  const responsableUsuario = users.find(
    (user) => Number(user.id_usuario) === Number(responsableUsuarioId),
  );

  if (!responsableUsuario) {
    return {
      ok: false,
      message: "El usuario responsable indicado no existe.",
    };
  }

  return {
    ok: true,
    users,
    responsableUsuario,
    sharedLocationId,
  };
}

async function syncFosterHomeMembers({
  manager,
  fosterHomeId,
  usuariosAsociados,
  responsableUsuarioId,
}) {
  const memberRepository = manager.getRepository(FosterHomeMember);
  const existingMembers = await memberRepository.find({
    where: {
      foster_home: { id_hogar_temporal: Number(fosterHomeId) },
    },
    relations: {
      user: {
        location: true,
      },
      foster_home: true,
    },
  });

  const selectedIds = new Set(usuariosAsociados.map((id) => Number(id)));

  for (const member of existingMembers) {
    const isSelected = selectedIds.has(Number(member.user?.id_usuario));
    member.activo = isSelected;
    member.rol =
      Number(member.user?.id_usuario) === Number(responsableUsuarioId)
        ? FosterHomeMemberRole.RESPONSABLE
        : FosterHomeMemberRole.MIEMBRO;
  }

  const existingUserIds = new Set(
    existingMembers
      .map((member) => member.user?.id_usuario)
      .filter((value) => value !== undefined && value !== null)
      .map((value) => Number(value)),
  );

  const newMembers = usuariosAsociados
    .filter((userId) => !existingUserIds.has(Number(userId)))
    .map((userId) =>
      memberRepository.create({
        foster_home: { id_hogar_temporal: Number(fosterHomeId) },
        user: { id_usuario: Number(userId) },
        rol:
          Number(userId) === Number(responsableUsuarioId)
            ? FosterHomeMemberRole.RESPONSABLE
            : FosterHomeMemberRole.MIEMBRO,
        activo: true,
      }),
    );

  await memberRepository.save([...existingMembers, ...newMembers]);
  return existingMembers;
}

function extractLocationIdsFromMembers(members = []) {
  return [...new Set(
    members
      .map((member) => member.user?.location?.ubicacion_id)
      .filter((value) => value !== undefined && value !== null)
      .map((value) => Number(value)),
  )];
}

function hasActiveAssignments(home) {
  return (home?.foster_assignments || []).some(
    (assignment) => assignment?.estado === Estado.ACTIVO,
  );
}

export async function createFosterHomeService(body, authContext = {}) {
  try {
    if (hasDuplicateAllowedAnimalRules(body.allowed_animals || [])) {
      return [null, "No se permiten reglas activas duplicadas para la misma especie y estado."];
    }

    const homeId = await AppDataSource.transaction(async (manager) => {
      const usersValidation = await validateFosterHomeUsers({
        manager,
        usuariosAsociados: body.usuarios_asociados,
        responsableUsuarioId: body.responsable_usuario_id,
        homeIsActive: body.activo !== undefined ? Boolean(body.activo) : true,
      });
      if (!usersValidation.ok) {
        throw new Error(usersValidation.message);
      }

      const fosterHomeRepository = manager.getRepository(FosterHome);
      const allowedAnimalRepository = manager.getRepository(FosterHomeAllowedAnimal);

      const fosterHome = fosterHomeRepository.create({
        observaciones: normalizeNullableString(body.observaciones),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        responsable_usuario: {
          id_usuario: Number(body.responsable_usuario_id),
        },
      });

      const savedHome = await fosterHomeRepository.save(fosterHome);

      await syncFosterHomeMembers({
        manager,
        fosterHomeId: savedHome.id_hogar_temporal,
        usuariosAsociados: body.usuarios_asociados,
        responsableUsuarioId: body.responsable_usuario_id,
      });

      const allowedAnimals = Array.isArray(body.allowed_animals) ? body.allowed_animals : [];

      if (allowedAnimals.length > 0) {
        const allowedAnimalEntities = allowedAnimals.map((item) =>
          allowedAnimalRepository.create({
            especie: item.especie,
            estado_permitido: item.estado_permitido,
            capacidad_maxima: item.capacidad_maxima ?? null,
            observaciones: normalizeNullableString(item.observaciones),
            activo: item.activo !== undefined ? Boolean(item.activo) : true,
            foster_home: { id_hogar_temporal: Number(savedHome.id_hogar_temporal) },
          }),
        );

        await allowedAnimalRepository.save(allowedAnimalEntities);
      }

      await syncLocationType(manager, [usersValidation.sharedLocationId]);

      return savedHome.id_hogar_temporal;
    });

    const createdHome = await getFosterHomeWithDetails(homeId);
    return [serializeFosterHome(createdHome, buildFosterHomeSerializationOptions(authContext)), null];
  } catch (error) {
    console.error("Error al crear hogar temporal:", error);
    return [null, error.message || "Error interno al crear hogar temporal"];
  }
}

export async function getFosterHomeService(query, authContext = {}) {
  try {
    const [hasAccess, accessError] = await ensureScopedFosterHomeAccess(query.id, authContext);
    if (!hasAccess) return [null, accessError, 403];

    const homeFound = await getFosterHomeWithDetails(query.id);

    if (!homeFound) return [null, "Hogar temporal no encontrado"];

    return [serializeFosterHome(homeFound, buildFosterHomeSerializationOptions(authContext)), null];
  } catch (error) {
    console.error("Error al obtener hogar temporal:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getFosterHomesService(authContext = {}) {
  try {
    if (await isScopedFosterHomeUser(authContext)) {
      const associatedHomeId = await getAssociatedFosterHomeIdForUser(authContext.user?.id_usuario);
      if (!associatedHomeId) return [[], null];

      const ownHome = await getFosterHomeWithDetails(associatedHomeId);
      if (!ownHome) return [[], null];

      return [
        [
          serializeFosterHome(ownHome, buildFosterHomeSerializationOptions(authContext, {
            includeAllAllowedAnimals: false,
          })),
        ],
        null,
      ];
    }

    const fosterHomeRepository = AppDataSource.getRepository(FosterHome);
    const homes = await fosterHomeRepository.find({
      relations: {
        responsable_usuario: {
          location: locationRelations,
        },
        miembros: {
          user: {
            location: locationRelations,
          },
        },
        allowed_animals: true,
        foster_assignments: {
          animal: true,
        },
      },
    });

    if (!homes || homes.length === 0) return [null, "No hay hogares temporales"];

    return [
      homes.map((home) =>
        serializeFosterHome(home, {
          includeObservations: false,
        })),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener hogares temporales:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateFosterHomeService(query, body, authContext = {}) {
  try {
    const home = await AppDataSource.transaction(async (manager) => {
      const fosterHomeRepository = manager.getRepository(FosterHome);
      const homeFound = await fosterHomeRepository.findOne({
        where: { id_hogar_temporal: Number(query.id) },
        relations: {
          responsable_usuario: {
            location: locationRelations,
          },
          miembros: {
            user: {
              location: locationRelations,
            },
          },
          foster_assignments: true,
        },
      });

      if (!homeFound) {
        throw new Error("Hogar temporal no encontrado");
      }

      const currentAssociatedUsers = (homeFound.miembros || [])
        .filter((member) => Boolean(member?.activo))
        .map((member) => Number(member.user?.id_usuario))
        .filter((value) => !Number.isNaN(value));

      const finalAssociatedUsers =
        body.usuarios_asociados !== undefined
          ? body.usuarios_asociados.map((id) => Number(id))
          : currentAssociatedUsers;
      const finalResponsibleUsuarioId =
        body.responsable_usuario_id !== undefined
          ? Number(body.responsable_usuario_id)
          : Number(homeFound.responsable_usuario?.id_usuario);
      const finalActive =
        body.activo !== undefined ? Boolean(body.activo) : Boolean(homeFound.activo);

      if (!finalActive && hasActiveAssignments(homeFound)) {
        throw new Error(
          "No se puede desactivar el hogar temporal mientras tenga asignaciones activas. Debes cerrarlas primero.",
        );
      }

      const previousLocationIds = extractLocationIdsFromMembers(homeFound.miembros || []);

      const usersValidation = await validateFosterHomeUsers({
        manager,
        usuariosAsociados: finalAssociatedUsers,
        responsableUsuarioId: finalResponsibleUsuarioId,
        currentHomeId: homeFound.id_hogar_temporal,
        homeIsActive: finalActive,
      });

      if (!usersValidation.ok) {
        throw new Error(usersValidation.message);
      }

      if (body.observaciones !== undefined) {
        homeFound.observaciones = normalizeNullableString(body.observaciones);
      }
      if (body.activo !== undefined) {
        homeFound.activo = Boolean(body.activo);
      }

      homeFound.responsable_usuario = {
        id_usuario: Number(finalResponsibleUsuarioId),
      };

      await fosterHomeRepository.save(homeFound);

      await syncFosterHomeMembers({
        manager,
        fosterHomeId: homeFound.id_hogar_temporal,
        usuariosAsociados: finalAssociatedUsers,
        responsableUsuarioId: finalResponsibleUsuarioId,
      });

      await syncLocationType(manager, [
        ...previousLocationIds,
        usersValidation.sharedLocationId,
      ]);

      return homeFound.id_hogar_temporal;
    });

    const updatedHome = await getFosterHomeWithDetails(home);
    return [serializeFosterHome(updatedHome, buildFosterHomeSerializationOptions(authContext)), null];
  } catch (error) {
    console.error("Error al modificar hogar temporal:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteFosterHomeService(query, authContext = {}) {
  try {
    const deletedHome = await AppDataSource.transaction(async (manager) => {
      const fosterHomeRepository = manager.getRepository(FosterHome);
      const homeFound = await fosterHomeRepository.findOne({
        where: { id_hogar_temporal: Number(query.id) },
        relations: {
          miembros: {
            user: {
              location: true,
            },
          },
          foster_assignments: true,
        },
      });

      if (!homeFound) {
        throw new Error("Hogar temporal no encontrado");
      }

      if (hasActiveAssignments(homeFound)) {
        throw new Error(
          "No se puede desactivar el hogar temporal mientras tenga asignaciones activas. Debes cerrarlas primero.",
        );
      }

      if (!homeFound.activo) {
        return homeFound.id_hogar_temporal;
      }

      const previousLocationIds = extractLocationIdsFromMembers(homeFound.miembros || []);
      homeFound.activo = false;
      await fosterHomeRepository.save(homeFound);
      await syncLocationType(manager, previousLocationIds);

      return homeFound.id_hogar_temporal;
    });

    const updatedHome = await getFosterHomeWithDetails(deletedHome);
    return [serializeFosterHome(updatedHome, buildFosterHomeSerializationOptions(authContext)), null];
  } catch (error) {
    console.error("Error al eliminar hogar temporal:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function getEligibleAnimalsForFosterHomeService(query, authContext = {}) {
  try {
    const [hasAccess, accessError] = await ensureScopedFosterHomeAccess(query.id, authContext);
    if (!hasAccess) return [null, accessError, 403];

    const fosterHome = await getFosterHomeWithDetails(query.id);
    if (!fosterHome) {
      return [null, "Hogar temporal no encontrado"];
    }

    if (!fosterHome.activo) {
      return [null, "El hogar temporal esta inactivo."];
    }

    const activeAssignmentRepository = AppDataSource.getRepository(FosterAssignment);
    const activeAssignments = await activeAssignmentRepository.find({
      where: { estado: Estado.ACTIVO },
      relations: {
        animal: true,
        foster_home: true,
      },
    });

    const assignedAnimalIds = new Set(
      activeAssignments
        .map((assignment) => assignment?.animal?.id_animal)
        .filter((value) => value !== undefined && value !== null)
        .map((value) => Number(value)),
    );

    const animalRepository = AppDataSource.getRepository(Animal);
    const animals = await animalRepository.find({
      relations: {
        region: true,
      },
    });

    const eligibleAnimals = animals
      .filter((animal) => !animal.fallecido)
      .filter((animal) => !assignedAnimalIds.has(Number(animal.id_animal)))
      .map((animal) => {
        const compatibility = resolveCompatibleRuleForAnimal(animal, fosterHome);
        if (!compatibility.ok) return null;

        return buildEligibleAnimalPayload(
          animal,
          compatibility.rule,
          fosterHome.foster_assignments || [],
        );
      })
      .filter(Boolean);

    if (eligibleAnimals.length === 0) {
      return [null, "No hay animales elegibles para este hogar temporal."];
    }

    return [eligibleAnimals, null];
  } catch (error) {
    console.error("Error al obtener animales elegibles:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getMyFosterHomeService(authContext = {}) {
  try {
    const associatedHomeId = await getAssociatedFosterHomeIdForUser(authContext.user?.id_usuario);
    if (!associatedHomeId) {
      return [null, "No tienes un hogar temporal asociado.", 404];
    }

    const homeFound = await getFosterHomeWithDetails(associatedHomeId);
    if (!homeFound) {
      return [null, "No se pudo resolver tu hogar temporal asociado.", 404];
    }

    return [serializeFosterHome(homeFound, buildFosterHomeSerializationOptions(authContext)), null];
  } catch (error) {
    console.error("Error al obtener el hogar temporal asociado:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getAllowedAnimalsByFosterHomeService(fosterHomeId) {
  try {
    const fosterHome = await getFosterHomeWithDetails(fosterHomeId);
    if (!fosterHome) {
      return [null, "Hogar temporal no encontrado"];
    }

    return [
      (fosterHome.allowed_animals || []).map((rule) => serializeAllowedAnimal(rule)),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener reglas permitidas del hogar temporal:", error);
    return [null, "Error interno del servidor"];
  }
}

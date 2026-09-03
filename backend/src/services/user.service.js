"use strict";

import { In } from "typeorm";
import { AppDataSource } from "../config/configDb.js";
import Area from "../entities/area.entity.js";
import User from "../entities/user.entity.js";
import Role from "../entities/RolesConcept/role.entity.js";
import UserArea from "../entities/user_area.entity.js";
import UserRole from "../entities/user_role.entity.js";
import { encryptPassword } from "../helpers/bcrypt.helper.js";
import { revokeRefreshTokensForUser } from "./auth.session.shared.js";
import {
  buildUserLocationName,
  createManagedLocation,
  locationRelations,
  mapLocationSummary,
  updateManagedLocation,
} from "./location.shared.js";

const PASSWORD_FIELD = "contrase\u00f1a";
const ALT_PASSWORD_FIELD = "contraseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±a";
const USER_UNIQUE_FIELDS = ["rut", "email", "telefono"];
const UNIQUE_FIELD_MESSAGES = {
  rut: "Ya existe otro usuario con el rut ingresado.",
  email: "Ya existe otro usuario con el correo electrónico ingresado.",
  telefono: "Ya existe otro usuario con el telefono ingresado.",
};
const RELATION_FIELD_MESSAGES = {
  area_ids: {
    array: "Las areas seleccionadas deben enviarse como un arreglo.",
    invalid: "Una o mas areas seleccionadas no son validas.",
    duplicate: "No se pueden repetir areas seleccionadas.",
    min: "Debe asignar al menos un area al usuario.",
    missing: "Una o mas areas seleccionadas no existen.",
  },
  role_ids: {
    array: "Los roles seleccionados deben enviarse como un arreglo.",
    invalid: "Uno o mas roles seleccionados no son validos.",
    duplicate: "No se pueden repetir roles seleccionados.",
    min: "Debe asignar al menos un rol al usuario.",
    missing: "Uno o mas roles seleccionados no existen.",
  },
};

function buildUserServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function normalizeServiceError(error, fallbackMessage) {
  return mapUniqueConstraintUserError(error)
    || (error?.message ? error : fallbackMessage);
}

function getIncomingPassword(body = {}) {
  return body[PASSWORD_FIELD] ?? body[ALT_PASSWORD_FIELD] ?? null;
}

function stripPasswordFields(user = {}) {
  const sanitized = { ...user };
  delete sanitized[PASSWORD_FIELD];
  delete sanitized[ALT_PASSWORD_FIELD];
  return sanitized;
}

function serializeRole(role) {
  if (!role) return null;

  return {
    id_rol: role.id_rol,
    nombre: role.nombre || "",
  };
}

function serializeArea(area) {
  if (!area) return null;

  return {
    id_area: area.id_area,
    nombre: area.nombre || "",
  };
}

function collectRoleItems(user = {}) {
  const seenIds = new Set();

  return (user.UserRole || [])
    .map((userRole) => serializeRole(userRole.role))
    .filter((role) => {
      if (!role?.id_rol || seenIds.has(role.id_rol)) {
        return false;
      }

      seenIds.add(role.id_rol);
      return true;
    });
}

function collectAreaItems(user = {}) {
  const relationAreas = (user.UserArea || [])
    .map((userArea) => serializeArea(userArea.area))
    .filter(Boolean);

  if (relationAreas.length > 0) {
    return relationAreas;
  }

  const legacyArea = serializeArea(user.area);
  return legacyArea ? [legacyArea] : [];
}

function sanitizeUser(user) {
  if (!user) return null;

  const roleItems = collectRoleItems(user);
  const areaItems = collectAreaItems(user);
  const primaryArea = areaItems[0] || serializeArea(user.area);
  const userData = stripPasswordFields(user);

  delete userData.UserRole;
  delete userData.UserArea;

  return {
    ...userData,
    roles: roleItems,
    role_names: roleItems.map((role) => role.nombre),
    areas: areaItems,
    area: primaryArea,
    location: mapLocationSummary(user.location),
    region: user.location?.region
      ? {
          id_region: user.location.region.id_region,
          clave: user.location.region.clave || "",
          nombre: user.location.region.nombre || "",
        }
      : null,
    comuna: user.location?.comuna
      ? {
          id_comuna: user.location.comuna.id_comuna,
          nombre: user.location.comuna.nombre || "",
          activo: Boolean(user.location.comuna.activo),
        }
      : null,
  };
}

async function getUserWithRelations(repository, where) {
  return repository.findOne({
    where,
    relations: {
      area: true,
      UserArea: {
        area: true,
      },
      location: locationRelations,
      UserRole: {
        role: true,
      },
    },
  });
}

function normalizeUniqueFieldValue(fieldName, value) {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  if (fieldName === "email") {
    return trimmedValue.toLowerCase();
  }

  return trimmedValue;
}

function buildDuplicateUserMessage(fieldName) {
  return UNIQUE_FIELD_MESSAGES[fieldName] || "Ya existe otro usuario con los datos ingresados.";
}

function mapUniqueConstraintUserError(error) {
  if (error?.code !== "23505") {
    return null;
  }

  const detail = `${error?.detail || ""} ${error?.constraint || ""}`.toLowerCase();

  if (detail.includes("rut")) {
    return buildUserServiceError(buildDuplicateUserMessage("rut"), 409);
  }

  if (detail.includes("email")) {
    return buildUserServiceError(buildDuplicateUserMessage("email"), 409);
  }

  if (detail.includes("telefono")) {
    return buildUserServiceError(buildDuplicateUserMessage("telefono"), 409);
  }

  return buildUserServiceError("Ya existe otro usuario con un dato unico duplicado.", 409);
}

function buildScalarUserPatch(userFound, body, nextHashedPassword = null, nextPrimaryArea = null) {
  const patch = {
    id_usuario: Number(userFound.id_usuario),
    nombre: body.nombre !== undefined ? body.nombre.trim() : userFound.nombre,
    apellido: body.apellido !== undefined ? body.apellido.trim() : userFound.apellido,
    rut: body.rut !== undefined ? body.rut.trim() : userFound.rut,
    email: body.email !== undefined ? body.email.trim().toLowerCase() : userFound.email,
    telefono: body.telefono !== undefined ? body.telefono.trim() : userFound.telefono,
    activo: body.activo !== undefined ? Boolean(body.activo) : Boolean(userFound.activo),
  };

  const nextAreaId = nextPrimaryArea
    ? Number(nextPrimaryArea.id_area)
    : Number(userFound.area?.id_area);
  const nextLocationId = Number(userFound.location?.ubicacion_id);

  if (Number.isInteger(nextAreaId) && nextAreaId > 0) {
    patch.area = { id_area: nextAreaId };
  }

  if (Number.isInteger(nextLocationId) && nextLocationId > 0) {
    patch.location = { ubicacion_id: nextLocationId };
  }

  if (nextHashedPassword) {
    patch[PASSWORD_FIELD] = nextHashedPassword;
  }

  return patch;
}

export const __testables = {
  assertUserUniqueFieldAvailability,
  buildScalarUserPatch,
  buildDuplicateUserMessage,
  mapUniqueConstraintUserError,
  normalizeIdArray,
  syncUserAreas,
  syncUserRoles,
};

function normalizeIdArray(values, fieldName) {
  const fieldMessages = RELATION_FIELD_MESSAGES[fieldName];

  if (!Array.isArray(values)) {
    throw buildUserServiceError(fieldMessages?.array || "Debe ser un arreglo.");
  }

  const parsedIds = values.map((value) => Number(value));
  const hasInvalidId = parsedIds.some((value) => !Number.isInteger(value) || value <= 0);

  if (hasInvalidId) {
    throw buildUserServiceError(fieldMessages?.invalid || "Contiene ids invalidos.");
  }

  const dedupedIds = Array.from(new Set(parsedIds));
  if (dedupedIds.length !== parsedIds.length) {
    throw buildUserServiceError(fieldMessages?.duplicate || "No se permiten ids duplicados.");
  }

  if (dedupedIds.length === 0) {
    throw buildUserServiceError(fieldMessages?.min || "Debe contener al menos un elemento.");
  }

  return dedupedIds;
}

async function resolveAreas(manager, areaIds) {
  const normalizedAreaIds = normalizeIdArray(areaIds, "area_ids");
  const areaRepository = manager.getRepository(Area);
  const areas = await areaRepository.find({
    where: { id_area: In(normalizedAreaIds) },
    order: { id_area: "ASC" },
  });

  if (areas.length !== normalizedAreaIds.length) {
    throw buildUserServiceError(RELATION_FIELD_MESSAGES.area_ids.missing);
  }

  const byId = new Map(areas.map((area) => [Number(area.id_area), area]));
  return normalizedAreaIds.map((areaId) => byId.get(areaId));
}

async function resolveRoles(manager, roleIds) {
  const normalizedRoleIds = normalizeIdArray(roleIds, "role_ids");
  const roleRepository = manager.getRepository(Role);
  const roles = await roleRepository.find({
    where: { id_rol: In(normalizedRoleIds) },
    order: { id_rol: "ASC" },
  });

  if (roles.length !== normalizedRoleIds.length) {
    throw buildUserServiceError(RELATION_FIELD_MESSAGES.role_ids.missing);
  }

  const byId = new Map(roles.map((role) => [Number(role.id_rol), role]));
  return normalizedRoleIds.map((roleId) => byId.get(roleId));
}

async function syncUserRoles({ manager, userId, roles }) {
  const userRoleRepository = manager.getRepository(UserRole);

  await userRoleRepository.delete({
    user: { id_usuario: Number(userId) },
  });

  if (!Array.isArray(roles) || roles.length === 0) {
    return;
  }

  const nextUserRoles = roles.map((role) =>
    userRoleRepository.create({
      user: { id_usuario: Number(userId) },
      role: { id_rol: Number(role.id_rol) },
    }),
  );

  await userRoleRepository.save(nextUserRoles);
}

async function syncUserAreas({ manager, userId, areas }) {
  const userAreaRepository = manager.getRepository(UserArea);

  await userAreaRepository.delete({
    user: { id_usuario: Number(userId) },
  });

  if (!Array.isArray(areas) || areas.length === 0) {
    return;
  }

  const nextUserAreas = areas.map((area) =>
    userAreaRepository.create({
      user: { id_usuario: Number(userId) },
      area: { id_area: Number(area.id_area) },
    }),
  );

  await userAreaRepository.save(nextUserAreas);
}

function buildCreateRoleIds(body = {}) {
  if (Array.isArray(body.role_ids)) {
    return body.role_ids;
  }

  if (body.role_id !== undefined && body.role_id !== null && body.role_id !== "") {
    return [body.role_id];
  }

  throw buildUserServiceError("Debe asignar al menos un rol al usuario.");
}

function buildCreateAreaIds(body = {}) {
  if (Array.isArray(body.area_ids)) {
    return body.area_ids;
  }

  if (body.area_id !== undefined && body.area_id !== null && body.area_id !== "") {
    return [body.area_id];
  }

  throw buildUserServiceError("Debe asignar al menos un area al usuario.");
}

async function assertUserUniqueFieldAvailability(
  userRepository,
  uniqueFieldValues = {},
  excludeUserId = null,
) {
  for (const fieldName of USER_UNIQUE_FIELDS) {
    if (!(fieldName in uniqueFieldValues)) {
      continue;
    }

    const fieldValue = normalizeUniqueFieldValue(fieldName, uniqueFieldValues[fieldName]);
    if (!fieldValue) {
      continue;
    }

    const existingUser = await userRepository.findOne({
      where: { [fieldName]: fieldValue },
    });

    if (
      existingUser
      && Number(existingUser.id_usuario) !== Number(excludeUserId)
    ) {
      throw buildUserServiceError(buildDuplicateUserMessage(fieldName), 409);
    }
  }
}

export async function createUserService(body) {
  try {
    const password = getIncomingPassword(body);

    const user = await AppDataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);

      await assertUserUniqueFieldAvailability(userRepository, {
        rut: body.rut,
        email: body.email,
        telefono: body.telefono,
      });

      const areas = await resolveAreas(manager, buildCreateAreaIds(body));
      const roles = await resolveRoles(manager, buildCreateRoleIds(body));

      const location = await createManagedLocation(manager, {
        ...body.location,
        tipo: "PERSONA",
        nombre_ubicacion: buildUserLocationName(body),
      });

      const passwordHashed = await encryptPassword(password);
      const primaryArea = areas[0];
      const newUser = userRepository.create({
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
        rut: body.rut.trim(),
        email: body.email.trim().toLowerCase(),
        [PASSWORD_FIELD]: passwordHashed,
        telefono: body.telefono.trim(),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        area: { id_area: Number(primaryArea.id_area) },
        location: { ubicacion_id: Number(location.ubicacion_id) },
      });

      const savedUser = await userRepository.save(newUser);

      await syncUserAreas({
        manager,
        userId: savedUser.id_usuario,
        areas,
      });

      await syncUserRoles({
        manager,
        userId: savedUser.id_usuario,
        roles,
      });

      return getUserWithRelations(userRepository, {
        id_usuario: savedUser.id_usuario,
      });
    });

    return [sanitizeUser(user), null];
  } catch (error) {
    console.error("Error al crear usuario:", error);
    return [null, normalizeServiceError(error, "Error interno al crear usuario")];
  }
}

export async function getUserService(query) {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const userFound = await userRepository.findOne({
      where: [
        query.id ? { id_usuario: Number(query.id) } : null,
        query.rut ? { rut: query.rut } : null,
        query.email ? { email: query.email } : null,
      ].filter(Boolean),
      relations: {
        area: true,
        UserArea: {
          area: true,
        },
        location: locationRelations,
        UserRole: {
          role: true,
        },
      },
    });

    if (!userFound) return [null, "Usuario no encontrado"];

    return [sanitizeUser(userFound), null];
  } catch (error) {
    console.error("Error obtener el usuario:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getUsersService() {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const users = await userRepository.find({
      relations: {
        area: true,
        UserArea: {
          area: true,
        },
        location: locationRelations,
        UserRole: {
          role: true,
        },
      },
      order: {
        nombre: "ASC",
      },
    });

    if (!users || users.length === 0) return [null, "No hay usuarios"];

    return [users.map(sanitizeUser), null];
  } catch (error) {
    console.error("Error al obtener a los usuarios:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateUserService(query, body) {
  try {
    const user = await AppDataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);
      const userFound = await userRepository.findOne({
        where: [
          query.id ? { id_usuario: Number(query.id) } : null,
          query.rut ? { rut: query.rut } : null,
          query.email ? { email: query.email } : null,
        ].filter(Boolean),
        relations: {
          area: true,
          UserArea: { area: true },
          UserRole: { role: true },
          location: locationRelations,
        },
      });

      if (!userFound) {
        throw buildUserServiceError("Usuario no encontrado", 404);
      }

      await assertUserUniqueFieldAvailability(
        userRepository,
        {
          ...(body.rut !== undefined ? { rut: body.rut } : {}),
          ...(body.email !== undefined ? { email: body.email } : {}),
          ...(body.telefono !== undefined ? { telefono: body.telefono } : {}),
        },
        userFound.id_usuario,
      );

      const nextAreas =
        body.area_ids !== undefined || body.area_id !== undefined
          ? await resolveAreas(
              manager,
              body.area_ids !== undefined ? body.area_ids : [body.area_id],
            )
          : null;
      const nextRoles =
        body.role_ids !== undefined || body.role_id !== undefined
          ? await resolveRoles(
              manager,
              body.role_ids !== undefined ? body.role_ids : [body.role_id],
            )
          : null;
      const scalarPatch = buildScalarUserPatch(
        userFound,
        body,
        null,
        nextAreas?.[0] || null,
      );

      await userRepository.save(userRepository.create(scalarPatch));

      if (nextAreas) {
        await syncUserAreas({
          manager,
          userId: userFound.id_usuario,
          areas: nextAreas,
        });
      }

      const nextLocationName = buildUserLocationName({
        nombre: scalarPatch.nombre,
        apellido: scalarPatch.apellido,
      });

      await updateManagedLocation(manager, userFound.location?.ubicacion_id, {
        ...(body.location || {}),
        tipo: userFound.location?.tipo || "PERSONA",
        nombre_ubicacion: nextLocationName,
      });

      if (nextRoles) {
        await syncUserRoles({
          manager,
          userId: userFound.id_usuario,
          roles: nextRoles,
        });
      }

      return getUserWithRelations(userRepository, {
        id_usuario: userFound.id_usuario,
      });
    });

    return [sanitizeUser(user), null];
  } catch (error) {
    console.error("Error al modificar un usuario:", error);
    return [null, normalizeServiceError(error, "Error interno del servidor")];
  }
}

export async function resetUserPasswordService(userId, actorUserId, body) {
  try {
    const parsedUserId = Number(userId);
    const parsedActorUserId = Number(actorUserId);

    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      return [null, buildUserServiceError("El usuario seleccionado no existe.", 404)];
    }

    if (!Number.isInteger(parsedActorUserId) || parsedActorUserId <= 0) {
      return [
        null,
        buildUserServiceError(
          "No fue posible identificar al usuario autenticado.",
          401,
        ),
      ];
    }

    if (parsedUserId === parsedActorUserId) {
      return [
        null,
        buildUserServiceError(
          "Para cambiar tu propia contrasena utiliza Mi Perfil.",
          400,
        ),
      ];
    }

    const resetResult = await AppDataSource.transaction(async (manager) => {
      const userRepository = manager.getRepository(User);

      const userFound = await userRepository.findOne({
        where: { id_usuario: parsedUserId },
      });

      if (!userFound) {
        throw buildUserServiceError("El usuario seleccionado no existe.", 404);
      }

      const nextHashedPassword = await encryptPassword(body.new_password);
      await userRepository.save(
        userRepository.create({
          id_usuario: parsedUserId,
          [PASSWORD_FIELD]: nextHashedPassword,
        }),
      );

      const revokedSessions = await revokeRefreshTokensForUser(manager, parsedUserId);

      return {
        id_usuario: parsedUserId,
        revoked_sessions: revokedSessions,
      };
    });

    return [resetResult, null];
  } catch (error) {
    console.error("Error al restablecer contrasena de usuario:", error);
    return [null, normalizeServiceError(error, "No fue posible restablecer la contrasena del usuario.")];
  }
}

export async function deleteUserService(query) {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const userFound = await userRepository.findOne({
      where: [
        query.id ? { id_usuario: Number(query.id) } : null,
        query.rut ? { rut: query.rut } : null,
        query.email ? { email: query.email } : null,
      ].filter(Boolean),
    });

    if (!userFound) return [null, "Usuario no encontrado"];

    const deleted = await userRepository.remove(userFound);
    const userData = stripPasswordFields(deleted);

    return [userData, null];
  } catch (error) {
    console.error("Error al eliminar un usuario:", error);
    return [null, "Error interno del servidor"];
  }
}

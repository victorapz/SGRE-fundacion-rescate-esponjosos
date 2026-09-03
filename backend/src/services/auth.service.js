"use strict";

import crypto from "crypto";
import { AppDataSource } from "../config/configDb.js";
import User from "../entities/user.entity.js";
import RefreshToken from "../entities/refresh_tokens.entity.js";
import { comparePassword, encryptPassword } from "../helpers/bcrypt.helper.js";
import { revokeRefreshTokensForUser } from "./auth.session.shared.js";
import {
  buildUserLocationName,
  createManagedLocation,
  locationRelations,
  mapLocationSummary,
  updateManagedLocation,
} from "./location.shared.js";
import {
  ensureAuthSecrets,
  issueAccessToken,
  issueRefreshToken,
  tokenHash,
  verifyRefreshToken,
} from "../utils/authTokens.js";

const PASSWORD_FIELD = "contrase\u00f1a";
const ALT_PASSWORD_FIELD = "contraseÃƒÂ±a";

function createErrorMessage(dataInfo, message) {
  return {
    dataInfo,
    message,
  };
}

function collectRoles(userFound) {
  const roles = userFound?.UserRole?.map((userRole) => userRole.role?.nombre).filter(Boolean) || [];
  return Array.from(new Set(roles));
}

function collectPermissions(userFound) {
  const permissions = new Set();

  userFound?.UserRole?.forEach((userRole) => {
    userRole.role?.RolePermission?.forEach((rolePermission) => {
      if (rolePermission.permission?.nombre) {
        permissions.add(rolePermission.permission.nombre);
      }
    });
  });

  return Array.from(permissions);
}

async function persistRefreshToken(
  refreshRepo,
  userId,
  familyId,
  issuedToken,
  replacedByTokenHash = null,
) {
  const refreshTokenRecord = refreshRepo.create({
    familyId,
    tokenId: issuedToken.tokenId,
    tokenHash: issuedToken.tokenHash,
    revoked: false,
    compromised: false,
    replacedByTokenHash,
    expiresAt: issuedToken.expiresAt,
    user: { id_usuario: userId },
  });

  await refreshRepo.save(refreshTokenRecord);
}

async function compromiseFamily(refreshRepo, familyId) {
  await refreshRepo
    .createQueryBuilder()
    .update()
    .set({
      revoked: true,
      compromised: true,
      revokedAt: () => "CURRENT_TIMESTAMP",
    })
    .where("familyId = :familyId", { familyId })
    .execute();
}

function buildAuthContext(userFound) {
  const roleName = userFound.UserRole?.[0]?.role?.nombre;
  const roles = collectRoles(userFound);
  const permissions = collectPermissions(userFound);

  if (!roleName) {
    return {
      error: createErrorMessage("role", "El usuario no tiene un rol asignado"),
    };
  }

  return {
    roleName,
    roles,
    permissions,
  };
}

async function getUserForAuthByEmail(userRepository, email) {
  return userRepository.findOne({
    where: { email },
    relations: {
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
  });
}

async function getUserForAuthById(userRepository, userId) {
  return userRepository.findOne({
    where: { id_usuario: Number(userId) },
    relations: {
      area: true,
      UserArea: {
        area: true,
      },
      location: locationRelations,
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
  });
}

function serializeRole(role) {
  if (!role) return null;

  return {
    id: role.id_rol,
    id_rol: role.id_rol,
    nombre: role.nombre || "",
  };
}

function serializeArea(area) {
  if (!area) return null;

  return {
    id: area.id_area,
    id_area: area.id_area,
    nombre: area.nombre || "",
  };
}

function collectRoleItems(userFound = {}) {
  const seenIds = new Set();

  return (userFound.UserRole || [])
    .map((userRole) => serializeRole(userRole.role))
    .filter((role) => {
      if (!role?.id_rol || seenIds.has(role.id_rol)) {
        return false;
      }

      seenIds.add(role.id_rol);
      return true;
    });
}

function collectAreaItems(userFound = {}) {
  const relationAreas = (userFound.UserArea || [])
    .map((userArea) => serializeArea(userArea.area))
    .filter(Boolean);

  if (relationAreas.length > 0) {
    return relationAreas;
  }

  const legacyArea = serializeArea(userFound.area);
  return legacyArea ? [legacyArea] : [];
}

function buildMyProfilePayload(userFound) {
  const roleItems = collectRoleItems(userFound);
  const areaItems = collectAreaItems(userFound);
  const location = mapLocationSummary(userFound.location);

  return {
    id: userFound.id_usuario,
    nombre: userFound.nombre || "",
    apellido: userFound.apellido || "",
    email: userFound.email || "",
    telefono: userFound.telefono || "",
    roles: roleItems.map((role) => role.nombre),
    rolesDetailed: roleItems,
    role_names: roleItems.map((role) => role.nombre),
    areas: areaItems,
    areaNames: areaItems.map((area) => area.nombre),
    area: areaItems[0] || serializeArea(userFound.area),
    location,
    region: location?.region || null,
    comuna: location?.comuna || null,
  };
}

function buildMePayload(userFound, authContext) {
  return {
    ...buildMyProfilePayload(userFound),
    rol: authContext.roleName,
    roles: authContext.roles,
    permissions: authContext.permissions,
  };
}

function buildAuthServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

export async function loginService(user) {
  try {
    ensureAuthSecrets();

    const userRepository = AppDataSource.getRepository(User);
    const { email, password } = user;
    const userFound = await getUserForAuthByEmail(userRepository, email);

    if (!userFound) {
      return [null, null, createErrorMessage("email", "Credenciales incorrectas")];
    }

    if (!userFound.activo) {
      return [null, null, createErrorMessage("email", "Usuario invalido o inactivo")];
    }

    const hashedPassword = userFound?.[PASSWORD_FIELD] ?? userFound?.[ALT_PASSWORD_FIELD];
    const isMatch = await comparePassword(password, hashedPassword);

    if (!isMatch) {
      return [null, null, createErrorMessage("password", "Credenciales incorrectas")];
    }

    const authContext = buildAuthContext(userFound);
    if (authContext.error) {
      return [null, null, authContext.error];
    }

    const userId = userFound.id_usuario;
    const familyId = crypto.randomUUID();
    const accessToken = issueAccessToken(
      userId,
      authContext.roleName,
      authContext.roles,
      authContext.permissions,
    );
    const issuedRefreshToken = issueRefreshToken(userId, familyId);

    const refreshRepo = AppDataSource.getRepository(RefreshToken);
    await persistRefreshToken(refreshRepo, userId, familyId, issuedRefreshToken);

    return [accessToken, issuedRefreshToken.refreshToken, null];
  } catch (error) {
    console.error("Error al iniciar sesion:", error);
    return [null, null, "Error interno del servidor"];
  }
}

export async function refreshTokenService(refreshToken) {
  try {
    ensureAuthSecrets();

    if (!refreshToken) {
      return [null, createErrorMessage("refreshToken", "Refresh token requerido")];
    }

    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh" || !payload.familyId || !payload.tokenId || !payload.sub) {
      return [null, createErrorMessage("refreshToken", "Refresh token invalido")];
    }

    const hashedToken = tokenHash(refreshToken);
    const tokenResult = await AppDataSource.transaction(async (manager) => {
      const refreshRepo = manager.getRepository(RefreshToken);
      const userRepository = manager.getRepository(User);

      const storedToken = await refreshRepo.findOne({
        where: { tokenHash: hashedToken },
      });

      if (!storedToken) {
        await compromiseFamily(refreshRepo, payload.familyId);
        return {
          error: createErrorMessage("refreshToken", "Detectado refresh token reuse"),
        };
      }

      if (storedToken.compromised || storedToken.revoked) {
        await compromiseFamily(refreshRepo, storedToken.familyId);
        return {
          error: createErrorMessage("refreshToken", "Detectado refresh token reuse"),
        };
      }

      if (storedToken.expiresAt.getTime() <= Date.now()) {
        storedToken.revoked = true;
        storedToken.revokedAt = new Date();
        await refreshRepo.save(storedToken);
        return {
          error: createErrorMessage("refreshToken", "Refresh token invalido o expirado"),
        };
      }

      const nextUser = await getUserForAuthById(userRepository, payload.sub);

      if (!nextUser || !nextUser.activo) {
        return { error: createErrorMessage("refreshToken", "Usuario invalido o inactivo") };
      }

      const authContext = buildAuthContext(nextUser);
      if (authContext.error) {
        return { error: authContext.error };
      }

      const newAccessToken = issueAccessToken(
        nextUser.id_usuario,
        authContext.roleName,
        authContext.roles,
        authContext.permissions,
      );
      const issuedRefreshToken = issueRefreshToken(nextUser.id_usuario, storedToken.familyId);

      storedToken.revoked = true;
      storedToken.revokedAt = new Date();
      storedToken.replacedByTokenHash = issuedRefreshToken.tokenHash;
      await refreshRepo.save(storedToken);

      await persistRefreshToken(
        refreshRepo,
        nextUser.id_usuario,
        storedToken.familyId,
        issuedRefreshToken,
      );

      return {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: issuedRefreshToken.refreshToken,
        },
      };
    });

    if (tokenResult.error) {
      return [null, tokenResult.error];
    }

    return [tokenResult.tokens, null];
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return [null, createErrorMessage("refreshToken", "Refresh token invalido o expirado")];
    }

    console.error("Error al refrescar sesion:", error);
    return [null, createErrorMessage("refreshToken", "Error interno del servidor")];
  }
}

export async function logoutService(refreshToken) {
  try {
    ensureAuthSecrets();

    if (!refreshToken) {
      return [{ revoked: false }, null];
    }

    const payload = verifyRefreshToken(refreshToken);
    const hashedToken = tokenHash(refreshToken);
    const refreshRepo = AppDataSource.getRepository(RefreshToken);
    const storedToken = await refreshRepo.findOne({
      where: { tokenHash: hashedToken },
    });

    if (
      !storedToken
      || storedToken.familyId !== payload.familyId
      || storedToken.tokenId !== payload.tokenId
    ) {
      return [{ revoked: false }, null];
    }

    if (!storedToken.revoked) {
      storedToken.revoked = true;
      storedToken.revokedAt = new Date();
      await refreshRepo.save(storedToken);
    }

    return [{ revoked: true }, null];
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return [{ revoked: false }, null];
    }

    console.error("Error al cerrar sesion:", error);
    return [null, createErrorMessage("refreshToken", "Error interno del servidor")];
  }
}

export async function getMyProfileService(userId) {
  try {
    const parsedId = Number(userId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return [null, buildAuthServiceError("Usuario invalido", 401)];
    }

    const userRepository = AppDataSource.getRepository(User);
    const userFound = await userRepository.findOne({
      where: { id_usuario: parsedId },
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

    if (!userFound || !userFound.activo) {
      return [null, buildAuthServiceError("Usuario no encontrado", 404)];
    }

    return [buildMyProfilePayload(userFound), null];
  } catch (error) {
    console.error("Error al obtener perfil propio:", error);
    return [null, buildAuthServiceError("Error interno del servidor", 500)];
  }
}

export async function updateMyProfileService(userId, body) {
  try {
    const updatedProfile = await AppDataSource.transaction(async (manager) => {
      const parsedId = Number(userId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw buildAuthServiceError("Usuario invalido", 401);
      }

      const userRepository = manager.getRepository(User);
      const userFound = await userRepository.findOne({
        where: { id_usuario: parsedId },
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

      if (!userFound || !userFound.activo) {
        throw buildAuthServiceError("Usuario no encontrado", 404);
      }

      const nextEmail = body.email !== undefined
        ? body.email.trim().toLowerCase()
        : userFound.email;
      const isEmailChanged = nextEmail !== userFound.email;

      if (isEmailChanged) {
        const confirmedEmail = String(body.email_confirm || "").trim().toLowerCase();

        if (!confirmedEmail) {
          throw buildAuthServiceError(
            "Debes confirmar el correo electrónico.",
            400,
          );
        }

        if (confirmedEmail !== nextEmail) {
          throw buildAuthServiceError(
            "El correo electrónico y su confirmacion no coinciden.",
            400,
          );
        }

        const duplicatedEmail = await userRepository.findOne({
          where: { email: nextEmail },
        });

        if (
          duplicatedEmail
          && Number(duplicatedEmail.id_usuario) !== Number(userFound.id_usuario)
        ) {
          throw buildAuthServiceError(
            "Ya existe otro usuario con el correo electrónico ingresado.",
            409,
          );
        }
      }

      const scalarPatch = {
        id_usuario: userFound.id_usuario,
        nombre: body.nombre !== undefined ? body.nombre.trim() : userFound.nombre,
        apellido: body.apellido !== undefined ? body.apellido.trim() : userFound.apellido,
        telefono: body.telefono !== undefined ? body.telefono.trim() : userFound.telefono,
        email: nextEmail,
      };

      if (body.location !== undefined) {
        const locationPayload = {
          ...body.location,
          tipo: userFound.location?.tipo || "PERSONA",
          nombre_ubicacion: buildUserLocationName({
            nombre: scalarPatch.nombre,
            apellido: scalarPatch.apellido,
          }),
        };

        if (userFound.location?.ubicacion_id) {
          await updateManagedLocation(manager, userFound.location.ubicacion_id, locationPayload);
        } else {
          const createdLocation = await createManagedLocation(manager, locationPayload);
          scalarPatch.location = { ubicacion_id: Number(createdLocation.ubicacion_id) };
        }
      }

      await userRepository.save(userRepository.create(scalarPatch));

      const refreshedUser = await userRepository.findOne({
        where: { id_usuario: userFound.id_usuario },
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

      return buildMyProfilePayload(refreshedUser);
    });

    return [updatedProfile, null];
  } catch (error) {
    console.error("Error al actualizar perfil propio:", error);
    return [
      null,
      error?.message
        ? error
        : buildAuthServiceError("No fue posible actualizar tu perfil.", 500),
    ];
  }
}

export async function changeMyPasswordService(userId, body, refreshToken = null) {
  try {
    const passwordResult = await AppDataSource.transaction(async (manager) => {
      const parsedId = Number(userId);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
        throw buildAuthServiceError("Usuario invalido", 401);
      }

      const userRepository = manager.getRepository(User);
      const userFound = await userRepository.findOne({
        where: { id_usuario: parsedId },
      });

      if (!userFound || !userFound.activo) {
        throw buildAuthServiceError("Usuario no encontrado", 404);
      }

      const storedPassword = userFound?.[PASSWORD_FIELD] ?? userFound?.[ALT_PASSWORD_FIELD];
      const currentPasswordMatches = await comparePassword(body.current_password, storedPassword);

      if (!currentPasswordMatches) {
        throw buildAuthServiceError("La contrasena actual no es correcta.", 400);
      }

      const isSamePassword = await comparePassword(body.new_password, storedPassword);
      if (isSamePassword) {
        throw buildAuthServiceError(
          "La nueva contrasena debe ser diferente de la actual.",
          400,
        );
      }

      const nextHashedPassword = await encryptPassword(body.new_password);
      await userRepository.save(
        userRepository.create({
          id_usuario: userFound.id_usuario,
          [PASSWORD_FIELD]: nextHashedPassword,
        }),
      );

      const currentRefreshTokenHash = refreshToken ? tokenHash(refreshToken) : null;
      const revokedSessions = await revokeRefreshTokensForUser(manager, userFound.id_usuario, {
        excludeTokenHash: currentRefreshTokenHash,
      });

      return {
        revoked_sessions: revokedSessions,
      };
    });

    return [passwordResult, null];
  } catch (error) {
    console.error("Error al cambiar contrasena propia:", error);
    return [
      null,
      error?.message
        ? error
        : buildAuthServiceError("No fue posible actualizar tu contrasena.", 500),
    ];
  }
}

export async function getMeService(userId) {
  try {
    const parsedId = Number(userId);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return [null, "Usuario invalido"];
    }

    const userRepository = AppDataSource.getRepository(User);
    const userFound = await getUserForAuthById(userRepository, parsedId);

    if (!userFound || !userFound.activo) {
      return [null, "Usuario no encontrado"];
    }

    const authContext = buildAuthContext(userFound);
    if (authContext.error) {
      return [null, authContext.error.message];
    }

    return [buildMePayload(userFound, authContext), null];
  } catch (error) {
    console.error("Error al obtener sesion:", error);
    return [null, "Error interno del servidor"];
  }
}

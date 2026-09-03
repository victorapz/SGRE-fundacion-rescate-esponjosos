"use strict";

import assert from "node:assert/strict";
import test from "node:test";
import { AppDataSource } from "../config/configDb.js";
import { comparePassword, encryptPassword } from "../helpers/bcrypt.helper.js";
import {
  changeMyPasswordService,
  getMeService,
  getMyProfileService,
  updateMyProfileService,
} from "./auth.service.js";
import { tokenHash } from "../utils/authTokens.js";

function buildUserWithAuth(overrides = {}) {
  return {
    id_usuario: 7,
    activo: true,
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    area: {
      id_area: 1,
      nombre: "Rescate",
    },
    UserArea: [
      {
        area: {
          id_area: 1,
          nombre: "Rescate",
        },
      },
    ],
    location: {
      ubicacion_id: 5,
      tipo: "PERSONA",
      nombre_ubicacion: "Casa de Ana Perez",
      direccion: "Calle 1",
      activo: true,
      observaciones: "Casa azul",
      region: {
        id_region: 8,
        clave: "BIOBIO",
        nombre: "Biobio",
      },
      comuna: {
        id_comuna: 81,
        nombre: "Chillan",
        activo: true,
      },
    },
    UserRole: [
      {
        role: {
          id_rol: 2,
          nombre: "Administrador",
          RolePermission: [
            { permission: { nombre: "users:user:read" } },
            { permission: { nombre: "users:user:update" } },
          ],
        },
      },
    ],
    ...overrides,
  };
}

test("getMeService devuelve identidad enriquecida sin exponer hash", async () => {
  const originalGetRepository = AppDataSource.getRepository;
  const userRecord = buildUserWithAuth({
    ["contrase\u00f1a"]: await encryptPassword("Password1"),
  });

  AppDataSource.getRepository = () => ({
    findOne: async () => userRecord,
  });

  try {
    const [me, error] = await getMeService(7);

    assert.equal(error, null);
    assert.equal(me.nombre, "Ana");
    assert.equal(me.apellido, "Perez");
    assert.equal(me.telefono, "+56911111111");
    assert.equal(me.email, "ana@fundacion.cl");
    assert.deepEqual(me.roles, ["Administrador"]);
    assert.deepEqual(me.permissions, ["users:user:read", "users:user:update"]);
    assert.equal("contrase\u00f1a" in me, false);
  } finally {
    AppDataSource.getRepository = originalGetRepository;
  }
});

test("getMyProfileService devuelve datos personales, roles, areas y ubicacion sin exponer permisos", async () => {
  const originalGetRepository = AppDataSource.getRepository;
  const userRecord = buildUserWithAuth({
    ["contrase\u00f1a"]: await encryptPassword("Password1"),
  });

  AppDataSource.getRepository = () => ({
    findOne: async () => userRecord,
  });

  try {
    const [profile, error] = await getMyProfileService(7);

    assert.equal(error, null);
    assert.equal(profile.id, 7);
    assert.equal(profile.nombre, "Ana");
    assert.equal(profile.apellido, "Perez");
    assert.equal(profile.email, "ana@fundacion.cl");
    assert.equal(profile.telefono, "+56911111111");
    assert.deepEqual(profile.roles, ["Administrador"]);
    assert.deepEqual(profile.areaNames, ["Rescate"]);
    assert.equal(profile.location.direccion, "Calle 1");
    assert.equal(profile.region.nombre, "Biobio");
    assert.equal(profile.comuna.nombre, "Chillan");
    assert.equal("permissions" in profile, false);
    assert.equal("contrase\u00f1a" in profile, false);
  } finally {
    AppDataSource.getRepository = originalGetRepository;
  }
});

test("updateMyProfileService permite actualizar nombre y telefono sin tocar campos administrativos", async () => {
  const originalTransaction = AppDataSource.transaction;
  let storedUser = buildUserWithAuth({
    ["contrase\u00f1a"]: await encryptPassword("Password1"),
  });

  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository() {
        return {
          findOne: async ({ where }) => {
            if (where?.email) {
              return null;
            }
            return storedUser;
          },
          create: (payload) => payload,
          save: async (payload) => {
            storedUser = {
              ...storedUser,
              ...payload,
            };
            return payload;
          },
        };
      },
    });

  try {
    const [profile, error] = await updateMyProfileService(7, {
      nombre: "Ana Maria",
      telefono: "+56922223333",
    });

    assert.equal(error, null);
    assert.equal(profile.nombre, "Ana Maria");
    assert.equal(profile.telefono, "+56922223333");
    assert.equal(profile.email, "ana@fundacion.cl");
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

test("updateMyProfileService exige confirmacion al cambiar correo", async () => {
  const originalTransaction = AppDataSource.transaction;
  const userRecord = buildUserWithAuth({
    ["contrase\u00f1a"]: await encryptPassword("Password1"),
  });

  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository() {
        return {
          findOne: async () => userRecord,
          save: async (payload) => payload,
          create: (payload) => payload,
        };
      },
    });

  try {
    const [result, error] = await updateMyProfileService(7, {
      email: "nuevo@fundacion.cl",
    });

    assert.equal(result, null);
    assert.equal(
      error?.message,
      "Debes confirmar el correo electrónico.",
    );
    assert.equal(error?.statusCode, 400);
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

test("changeMyPasswordService actualiza hash y revoca otras sesiones persistidas", async () => {
  const originalTransaction = AppDataSource.transaction;
  const currentRefreshToken = "refresh-token-actual";
  const currentRefreshTokenHash = tokenHash(currentRefreshToken);
  const initialPasswordHash = await encryptPassword("Actual123");
  let storedPasswordHash = initialPasswordHash;
  let revokedTokens = [];

  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository(entity) {
        if (entity?.options?.name === "User" || entity?.name === "User") {
          return {
            findOne: async () => ({
              id_usuario: 7,
              activo: true,
              ["contrase\u00f1a"]: storedPasswordHash,
            }),
            create: (payload) => payload,
            save: async (payload) => {
              storedPasswordHash = payload["contrase\u00f1a"];
              return payload;
            },
          };
        }

        return {
          find: async () => [
            {
              tokenHash: currentRefreshTokenHash,
              revoked: false,
              compromised: false,
            },
            {
              tokenHash: tokenHash("refresh-token-antiguo"),
              revoked: false,
              compromised: false,
            },
          ],
          save: async (tokens) => {
            revokedTokens = tokens;
            return tokens;
          },
        };
      },
    });

  try {
    const [result, error] = await changeMyPasswordService(
      7,
      {
        current_password: "Actual123",
        new_password: "Nueva123",
        confirm_password: "Nueva123",
      },
      currentRefreshToken,
    );

    assert.equal(error, null);
    assert.equal(result.revoked_sessions, 1);
    assert.equal(await comparePassword("Nueva123", storedPasswordHash), true);
    assert.equal(await comparePassword("Actual123", storedPasswordHash), false);
    assert.equal(revokedTokens.length, 1);
    assert.equal(revokedTokens[0].tokenHash, tokenHash("refresh-token-antiguo"));
    assert.equal(revokedTokens[0].revoked, true);
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

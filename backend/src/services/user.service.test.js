import assert from "node:assert/strict";
import test from "node:test";
import { AppDataSource } from "../config/configDb.js";
import { comparePassword, encryptPassword } from "../helpers/bcrypt.helper.js";
import { __testables } from "./user.service.js";
import { resetUserPasswordService } from "./user.service.js";

test("normalizeIdArray normaliza ids y rechaza duplicados o vacios", () => {
  assert.deepEqual(__testables.normalizeIdArray(["1", 2], "role_ids"), [1, 2]);

  assert.throws(
    () => __testables.normalizeIdArray([], "role_ids"),
    (error) => error.message === "Debe asignar al menos un rol al usuario.",
  );

  assert.throws(
    () => __testables.normalizeIdArray([1, "1"], "area_ids"),
    (error) => error.message === "No se pueden repetir areas seleccionadas.",
  );
});

test("assertUserUniqueFieldAvailability ignora al mismo usuario y detecta colisiones reales", async () => {
  const sameUserRepository = {
    async findOne() {
      return { id_usuario: 15 };
    },
  };

  await assert.doesNotReject(async () => {
    await __testables.assertUserUniqueFieldAvailability(
      sameUserRepository,
      { email: "mismo@fundacion.cl" },
      15,
    );
  });

  const duplicateRepository = {
    async findOne() {
      return { id_usuario: 22 };
    },
  };

  await assert.rejects(
    async () => {
      await __testables.assertUserUniqueFieldAvailability(
        duplicateRepository,
        { email: "duplicado@fundacion.cl" },
        15,
      );
    },
    (error) => (
      error?.statusCode === 409
      && error?.message === "Ya existe otro usuario con el correo electrónico ingresado."
    ),
  );
});

test("mapUniqueConstraintUserError humaniza violaciones de unicidad", () => {
  const duplicateError = __testables.mapUniqueConstraintUserError({
    code: "23505",
    detail: "Key (email)=(duplicado@fundacion.cl) already exists.",
  });
  const unknownConstraintError = __testables.mapUniqueConstraintUserError({
    code: "23505",
    constraint: "users_custom_unique",
  });

  assert.deepEqual(duplicateError, {
    message: "Ya existe otro usuario con el correo electrónico ingresado.",
    statusCode: 409,
  });
  assert.deepEqual(unknownConstraintError, {
    message: "Ya existe otro usuario con un dato unico duplicado.",
    statusCode: 409,
  });
});

test("buildScalarUserPatch genera una entidad parcial escalar sin colecciones relacionales", () => {
  const patch = __testables.buildScalarUserPatch(
    {
      id_usuario: 7,
      nombre: "Ana",
      apellido: "Perez",
      rut: "11.111.111-1",
      email: "ana@fundacion.cl",
      telefono: "+56911111111",
      activo: true,
      area: { id_area: 3 },
      location: { ubicacion_id: 12 },
      UserArea: [{ id_user_area: 1 }],
      UserRole: [{ id_user_role: 2 }],
    },
    {
      nombre: "Ana Maria",
      activo: false,
    },
    "hash-nuevo",
  );

  assert.deepEqual(patch, {
    id_usuario: 7,
    nombre: "Ana Maria",
    apellido: "Perez",
    rut: "11.111.111-1",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    activo: false,
    area: { id_area: 3 },
    location: { ubicacion_id: 12 },
    "contraseña": "hash-nuevo",
  });
  assert.equal("UserArea" in patch, false);
  assert.equal("UserRole" in patch, false);
});

test("syncUserAreas reemplaza relaciones borrando e insertando sin nullificar id_user", async () => {
  const deleteCalls = [];
  const saveCalls = [];
  const repository = {
    delete(criteria) {
      deleteCalls.push(criteria);
      return Promise.resolve();
    },
    create(payload) {
      return payload;
    },
    save(payload) {
      saveCalls.push(payload);
      return Promise.resolve(payload);
    },
  };

  await __testables.syncUserAreas({
    manager: {
      getRepository() {
        return repository;
      },
    },
    userId: 9,
    areas: [{ id_area: 2 }, { id_area: 5 }],
  });

  assert.deepEqual(deleteCalls, [{ user: { id_usuario: 9 } }]);
  assert.deepEqual(saveCalls[0], [
    { user: { id_usuario: 9 }, area: { id_area: 2 } },
    { user: { id_usuario: 9 }, area: { id_area: 5 } },
  ]);
});

test("syncUserRoles reemplaza relaciones borrando e insertando sin nullificar id_user", async () => {
  const deleteCalls = [];
  const saveCalls = [];
  const repository = {
    delete(criteria) {
      deleteCalls.push(criteria);
      return Promise.resolve();
    },
    create(payload) {
      return payload;
    },
    save(payload) {
      saveCalls.push(payload);
      return Promise.resolve(payload);
    },
  };

  await __testables.syncUserRoles({
    manager: {
      getRepository() {
        return repository;
      },
    },
    userId: 11,
    roles: [{ id_rol: 3 }, { id_rol: 4 }],
  });

  assert.deepEqual(deleteCalls, [{ user: { id_usuario: 11 } }]);
  assert.deepEqual(saveCalls[0], [
    { user: { id_usuario: 11 }, role: { id_rol: 3 } },
    { user: { id_usuario: 11 }, role: { id_rol: 4 } },
  ]);
});

test("resetUserPasswordService bloquea usar el flujo administrativo sobre la propia cuenta", async () => {
  const [result, error] = await resetUserPasswordService(9, 9, {
    new_password: "Nueva123",
    confirm_password: "Nueva123",
  });

  assert.equal(result, null);
  assert.equal(error?.message, "Para cambiar tu propia contrasena utiliza Mi Perfil.");
  assert.equal(error?.statusCode, 400);
});

test("resetUserPasswordService actualiza el hash y revoca refresh tokens del usuario objetivo", async () => {
  const originalTransaction = AppDataSource.transaction;
  const currentHash = await encryptPassword("Actual123");
  let storedHash = currentHash;
  let revokedTokens = [];

  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository(entity) {
        if (entity?.options?.name === "User" || entity?.name === "User") {
          return {
            findOne: async () => ({
              id_usuario: 12,
              activo: true,
              ["contrase\u00f1a"]: storedHash,
            }),
            create: (payload) => payload,
            save: async (payload) => {
              storedHash = payload["contrase\u00f1a"];
              return payload;
            },
          };
        }

        return {
          find: async () => [
            { tokenHash: "uno", revoked: false, compromised: false },
            { tokenHash: "dos", revoked: false, compromised: false },
          ],
          save: async (tokens) => {
            revokedTokens = tokens;
            return tokens;
          },
        };
      },
    });

  try {
    const [result, error] = await resetUserPasswordService(12, 1, {
      new_password: "Nueva123",
      confirm_password: "Nueva123",
    });

    assert.equal(error, null);
    assert.equal(result.id_usuario, 12);
    assert.equal(result.revoked_sessions, 2);
    assert.equal(await comparePassword("Nueva123", storedHash), true);
    assert.equal(await comparePassword("Actual123", storedHash), false);
    assert.equal(revokedTokens.length, 2);
    assert.equal(revokedTokens.every((token) => token.revoked === true), true);
  } finally {
    AppDataSource.transaction = originalTransaction;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  userCreateValidation,
  userPasswordResetBodyValidation,
  userUpdateBodyValidation,
} from "./user.validation.js";

const PASSWORD_FIELD = "contrase\u00f1a";

function buildValidUserPayload(overrides = {}) {
  return {
    nombre: "Jose",
    apellido: "Perez",
    email: "jose.perez@fundacion.cl",
    rut: "12.345.678-5",
    telefono: "+56912345678",
    activo: true,
    area_ids: [1],
    role_ids: [2],
    [PASSWORD_FIELD]: "Password1",
    location: {
      direccion: "Calle 123",
      region_id: 1,
      comuna_id: 2,
      observaciones: "",
    },
    ...overrides,
  };
}

test("userCreateValidation acepta nombres y apellidos unicode validos", () => {
  const validValues = [
    "Jose",
    "Jos\u00e9",
    "Mar\u00eda Jos\u00e9",
    "Mu\u00f1oz",
    "O'Connor",
    "D'Angelo",
    "Jean-Pierre",
    "Ana-Mar\u00eda",
    "\u00d1ancupil",
    "P\u00e9rez Contreras",
    "Mar\u00eda-Jos\u00e9 O\u2019Connor",
  ];

  for (const value of validValues) {
    const { error } = userCreateValidation.validate(
      buildValidUserPayload({
        nombre: value,
        apellido: value,
      }),
    );

    assert.equal(error, undefined, `Debio aceptar "${value}"`);
  }
});

test("userCreateValidation rechaza nombres invalidos", () => {
  const invalidValues = [
    "1234",
    "Jos\u00e9123",
    "--Jos\u00e9",
    "Jos\u00e9--",
    "'Oscar",
    "Oscar'",
    "***",
  ];

  for (const value of invalidValues) {
    const { error } = userCreateValidation.validate(
      buildValidUserPayload({
        nombre: value,
      }),
    );

    assert.ok(error, `Debio rechazar "${value}"`);
    assert.match(error.message, /solo puede contener letras/i);
  }
});

test("userCreateValidation rechaza arrays vacios con mensajes humanos", () => {
  const areaResult = userCreateValidation.validate(
    buildValidUserPayload({ area_ids: [] }),
  );
  const roleResult = userCreateValidation.validate(
    buildValidUserPayload({ role_ids: [] }),
  );

  assert.match(areaResult.error.message, /Debe asignar al menos un area al usuario/i);
  assert.match(roleResult.error.message, /Debe asignar al menos un rol al usuario/i);
});

test("userCreateValidation normaliza ids string numericos", () => {
  const { error, value } = userCreateValidation.validate(
    buildValidUserPayload({
      area_ids: ["1", 2],
      role_ids: ["3"],
    }),
  );

  assert.equal(error, undefined);
  assert.deepEqual(value.area_ids, [1, 2]);
  assert.deepEqual(value.role_ids, [3]);
});

test("userCreateValidation rechaza ids no numericos y duplicados", () => {
  const invalidIdsResult = userCreateValidation.validate(
    buildValidUserPayload({
      role_ids: ["abc"],
    }),
  );
  const duplicateIdsResult = userCreateValidation.validate(
    buildValidUserPayload({
      area_ids: [1, "1"],
    }),
  );

  assert.ok(invalidIdsResult.error);
  assert.match(invalidIdsResult.error.message, /El id debe ser un numero/i);
  assert.ok(duplicateIdsResult.error);
  assert.match(duplicateIdsResult.error.message, /No se pueden repetir areas seleccionadas/i);
});

test("userUpdateBodyValidation permite omitir campos relacionales", () => {
  const { error, value } = userUpdateBodyValidation.validate({
    nombre: "Ana-Mar\u00eda",
    activo: false,
  });

  assert.equal(error, undefined);
  assert.equal(value.nombre, "Ana-Mar\u00eda");
  assert.equal(value.activo, false);
  assert.equal("role_ids" in value, false);
  assert.equal("area_ids" in value, false);
});

test("userUpdateBodyValidation rechaza campos de contrasena administrativa mezclados con edicion general", () => {
  const { error } = userUpdateBodyValidation.validate({
    newPassword: "Nueva123",
  });

  assert.ok(error);
  assert.match(error.message, /No se permiten propiedades adicionales/i);
});

test("userPasswordResetBodyValidation exige confirmacion y usa la politica comun", () => {
  const validResult = userPasswordResetBodyValidation.validate({
    new_password: "Nueva123",
    confirm_password: "Nueva123",
  });
  const invalidResult = userPasswordResetBodyValidation.validate({
    new_password: "abc",
    confirm_password: "def",
  });

  assert.equal(validResult.error, undefined);
  assert.ok(invalidResult.error);
  assert.match(invalidResult.error.message, /contrasena|coinciden/i);
});

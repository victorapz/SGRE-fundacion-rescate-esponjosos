import assert from "node:assert/strict";
import test from "node:test";
import {
  myPasswordChangeValidation,
  myProfileUpdateValidation,
} from "./auth.validation.js";

test("myProfileUpdateValidation permite actualizar datos personales y rechaza campos administrativos", () => {
  const validResult = myProfileUpdateValidation.validate({
    nombre: "Ana",
    apellido: "Perez",
    telefono: "+56911111111",
    email: "ana@fundacion.cl",
  });
  const invalidResult = myProfileUpdateValidation.validate({
    nombre: "Ana",
    role_ids: [1],
  });

  assert.equal(validResult.error, undefined);
  assert.ok(invalidResult.error);
  assert.match(invalidResult.error.message, /No se permiten propiedades adicionales/i);
});

test("myPasswordChangeValidation exige confirmacion consistente", () => {
  const validResult = myPasswordChangeValidation.validate({
    current_password: "Actual123",
    new_password: "Nueva123",
    confirm_password: "Nueva123",
  });
  const invalidResult = myPasswordChangeValidation.validate({
    current_password: "Actual123",
    new_password: "Nueva123",
    confirm_password: "Otra1234",
  });

  assert.equal(validResult.error, undefined);
  assert.ok(invalidResult.error);
  assert.match(invalidResult.error.message, /contrasenas no coinciden/i);
});

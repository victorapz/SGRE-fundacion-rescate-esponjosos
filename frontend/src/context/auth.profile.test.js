import assert from "node:assert/strict";
import test from "node:test";
import { areSameAuthUser, normalizeAuthProfile } from "./auth.profile.js";

test("normalizeAuthProfile mezcla datos del perfil con el usuario base", () => {
  const normalized = normalizeAuthProfile(
    {
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@fundacion.cl",
      telefono: "+56911111111",
    },
    {
      id: 9,
      rol: "Administrador",
      roles: ["Administrador"],
      permissions: ["users:user:read"],
    },
  );

  assert.deepEqual(normalized, {
    id: 9,
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    rol: "Administrador",
    roles: ["Administrador"],
    permissions: ["users:user:read"],
  });
});

test("normalizeAuthProfile conserva valores del token cuando el perfil no los reemplaza", () => {
  const normalized = normalizeAuthProfile({}, {
    id: 7,
    nombre: "Token",
    apellido: "User",
    email: "token@fundacion.cl",
    telefono: "",
    rol: "Voluntario",
    roles: ["Voluntario"],
    permissions: [],
  });

  assert.equal(normalized.nombre, "Token");
  assert.equal(normalized.apellido, "User");
  assert.equal(normalized.email, "token@fundacion.cl");
  assert.equal(normalized.rol, "Voluntario");
});

test("areSameAuthUser evita cambios cuando el perfil normalizado no cambia", () => {
  const left = {
    id: 7,
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    rol: "Voluntario",
    roles: ["Voluntario"],
    permissions: ["users:user:read"],
  };
  const right = {
    id: 7,
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    rol: "Voluntario",
    roles: ["Voluntario"],
    permissions: ["users:user:read"],
  };

  assert.equal(areSameAuthUser(left, right), true);
  assert.equal(areSameAuthUser(left, { ...right, nombre: "Ana Maria" }), false);
});

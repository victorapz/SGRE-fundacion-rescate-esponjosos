import assert from "node:assert/strict";
import test from "node:test";
import { buildUserMenuIdentity } from "./userMenu.shared.js";

test("buildUserMenuIdentity prioriza nombre y apellido completos", () => {
  assert.deepEqual(
    buildUserMenuIdentity({
      nombre: "Victor",
      apellido: "Perez",
      email: "vperez@fundacion.cl",
      rol: "Administrador",
    }),
    {
      displayName: "Victor Perez",
      roleLabel: "Administrador",
      initial: "V",
    },
  );
});

test("buildUserMenuIdentity usa email o fallback seguro cuando faltan nombres", () => {
  assert.deepEqual(
    buildUserMenuIdentity({
      email: "sin.nombre@fundacion.cl",
    }),
    {
      displayName: "sin.nombre@fundacion.cl",
      roleLabel: "Sin rol",
      initial: "S",
    },
  );

  assert.deepEqual(
    buildUserMenuIdentity({}),
    {
      displayName: "Usuario autenticado",
      roleLabel: "Sin rol",
      initial: "U",
    },
  );
});

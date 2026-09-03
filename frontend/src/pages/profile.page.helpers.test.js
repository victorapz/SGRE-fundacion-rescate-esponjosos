import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMyPasswordPayload,
  buildProfileFormFromUser,
  buildProfileUpdatePayload,
  profileFormsEqual,
} from "./profile.page.helpers.js";

test("buildProfileFormFromUser normaliza el formulario inicial", () => {
  const form = buildProfileFormFromUser({
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
  });

  assert.deepEqual(form, {
    nombre: "Ana",
    apellido: "Perez",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    current_password: "",
  });
});

test("buildProfileUpdatePayload solo adjunta current_password si cambia el correo", () => {
  const sameEmailPayload = buildProfileUpdatePayload(
    {
      nombre: " Ana ",
      apellido: " Perez ",
      email: "ana@fundacion.cl",
      telefono: " +56911111111 ",
      current_password: "Password1",
    },
    { email: "ana@fundacion.cl" },
  );

  const changedEmailPayload = buildProfileUpdatePayload(
    {
      nombre: " Ana ",
      apellido: " Perez ",
      email: "nuevo@fundacion.cl",
      telefono: " +56911111111 ",
      current_password: "Password1",
    },
    { email: "ana@fundacion.cl" },
  );

  assert.equal("current_password" in sameEmailPayload, false);
  assert.equal(changedEmailPayload.current_password, "Password1");
  assert.equal(changedEmailPayload.email, "nuevo@fundacion.cl");
});

test("buildMyPasswordPayload y profileFormsEqual funcionan con cadenas limpias", () => {
  assert.deepEqual(
    buildMyPasswordPayload({
      current_password: " Actual1 ",
      new_password: " Nueva123 ",
      confirm_password: " Nueva123 ",
    }),
    {
      current_password: "Actual1",
      new_password: "Nueva123",
      confirm_password: "Nueva123",
    },
  );

  assert.equal(
    profileFormsEqual(
      { nombre: "Ana", apellido: "Perez", email: "ANA@fundacion.cl", telefono: "1" },
      { nombre: "Ana ", apellido: "Perez", email: "ana@fundacion.cl", telefono: "1 " },
    ),
    true,
  );
});

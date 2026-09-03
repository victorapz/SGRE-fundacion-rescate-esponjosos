import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_FIELD,
  buildUserPasswordResetPayload,
  buildUserPayload,
  createUserFormFromDetail,
} from "./volunteers.page.helpers.js";

function buildForm(overrides = {}) {
  return {
    nombre: " Jose ",
    apellido: " Perez ",
    rut: " 12.345.678-5 ",
    email: " Jose.Perez@Fundacion.cl ",
    telefono: " +56912345678 ",
    area_ids: ["1", "2"],
    role_ids: ["3"],
    [PASSWORD_FIELD]: "Password1",
    activo: true,
    location: {
      direccion: " Calle 123 ",
      region_id: "4",
      comuna_id: "5",
      observaciones: " Nota ",
    },
    ...overrides,
  };
}

test("buildUserPayload crea payload completo y normaliza ids", () => {
  const payload = buildUserPayload(buildForm(), {
    includePassword: true,
    includeRoleIds: true,
    includeAreaIds: true,
  });

  assert.deepEqual(payload, {
    nombre: "Jose",
    apellido: "Perez",
    rut: "12.345.678-5",
    email: "Jose.Perez@Fundacion.cl",
    telefono: "+56912345678",
    activo: true,
    area_ids: [1, 2],
    role_ids: [3],
    [PASSWORD_FIELD]: "Password1",
    location: {
      direccion: "Calle 123",
      region_id: 4,
      comuna_id: 5,
      observaciones: "Nota",
    },
  });
});

test("buildUserPayload omite relaciones no autorizadas en edición", () => {
  const payload = buildUserPayload(buildForm(), {
    includeRoleIds: false,
    includeAreaIds: false,
  });

  assert.equal("role_ids" in payload, false);
  assert.equal("area_ids" in payload, false);
  assert.equal(PASSWORD_FIELD in payload, false);
});

test("createUserFormFromDetail precarga ids y ubicación desde detalle", () => {
  const form = createUserFormFromDetail({
    nombre: "Ana",
    apellido: "Mu\u00f1oz",
    rut: "11.111.111-1",
    email: "ana@fundacion.cl",
    telefono: "+56911111111",
    activo: false,
    areas: [
      { id: 9, nombre: "Contenido" },
      { id: 10, nombre: "Administracion" },
    ],
    rolesDetailed: [
      { id: 5, nombre: "Voluntario" },
    ],
    direccion: "Calle 9",
    regionId: 13,
    comunaId: 13101,
    location: {
      observaciones: "Observación",
    },
  });

  assert.deepEqual(form.area_ids, ["9", "10"]);
  assert.deepEqual(form.role_ids, ["5"]);
  assert.equal(form.location.region_id, "13");
  assert.equal(form.location.comuna_id, "13101");
  assert.equal(form.location.observaciones, "Observación");
  assert.equal(form.activo, false);
});

test("buildUserPasswordResetPayload limpia el payload sensible separado", () => {
  assert.deepEqual(
    buildUserPasswordResetPayload({
      new_password: " Nueva123 ",
      confirm_password: " Nueva123 ",
    }),
    {
      new_password: "Nueva123",
      confirm_password: "Nueva123",
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVeterinarianPayload,
  buildVeterinarianClinicOptions,
  emptyVeterinarianForm,
  formatVeterinarianClinics,
} from "./settings.page.helpers.js";

test("emptyVeterinarianForm inicia clinicIds vacio", () => {
  assert.deepEqual(emptyVeterinarianForm().clinicIds, []);
});

test("buildVeterinarianPayload envia clinic_ids y compatibilidad legacy", () => {
  assert.deepEqual(
    buildVeterinarianPayload({
      nombre: " Ana ",
      apellido: " Perez ",
      email: "ana@fundacion.cl ",
      telefono: " +56912345678 ",
      clinicIds: ["5", "7", "7"],
      activo: true,
    }),
    {
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@fundacion.cl",
      telefono: "+56912345678",
      clinic_ids: [5, 7],
      clinic_id: 5,
      activo: true,
    },
  );

  assert.deepEqual(
    buildVeterinarianPayload({
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@fundacion.cl",
      telefono: "+56912345678",
      clinicIds: [],
      activo: false,
    }),
    {
      nombre: "Ana",
      apellido: "Perez",
      email: "ana@fundacion.cl",
      telefono: "+56912345678",
      clinic_ids: [],
      clinic_id: null,
      activo: false,
    },
  );
});

test("helpers de settings mantienen clínicas inactivas ya asociadas", () => {
  const options = buildVeterinarianClinicOptions(
    [
      { id: 1, nombre: "Clínica Activa", activo: true },
      { id: 2, nombre: "Clínica Inactiva", activo: false },
    ],
    ["2"],
  );

  assert.deepEqual(options.map((item) => item.id), [1, 2]);
  assert.equal(
    formatVeterinarianClinics({ clinics: [{ nombre: "Clínica Activa" }, { nombre: "Clínica Inactiva" }] }),
    "Clínica Activa, Clínica Inactiva",
  );
});

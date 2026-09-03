import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVeterinarian } from "./veterinarian.service.js";

test("normalizeVeterinarian conserva todas las clinicas asociadas y clinicIds", () => {
  const veterinarian = normalizeVeterinarian({
    id_veterinario: 7,
    nombre: "Maria",
    apellido: "Perez",
    clinics: [
      { id_clinica: 4, nombre: "Clinica Norte", activo: true },
      { id_clinica: 9, nombre: "Clinica Sur", activo: false },
    ],
    clinic: { id_clinica: 4, nombre: "Clinica Norte", activo: true },
  });

  assert.equal(veterinarian.id, 7);
  assert.deepEqual(veterinarian.clinicIds, [4, 9]);
  assert.equal(veterinarian.clinics.length, 2);
  assert.equal(veterinarian.clinicNombre, "Clinica Norte");
});

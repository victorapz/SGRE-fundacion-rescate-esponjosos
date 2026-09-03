import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVetClinic } from "./vet_clinic.service.js";

test("normalizeVetClinic conserva veterinarios asociados", () => {
  const clinic = normalizeVetClinic({
    id_clinica: 3,
    nombre: "Clinica Centro",
    veterinarians: [
      {
        id_veterinario: 2,
        nombre: "Ana",
        apellido: "Rios",
        activo: true,
      },
    ],
  });

  assert.equal(clinic.id, 3);
  assert.equal(clinic.veterinarians.length, 1);
  assert.equal(clinic.veterinarians[0].nombreCompleto, "Ana Rios");
});

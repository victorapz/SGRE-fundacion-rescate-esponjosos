import assert from "node:assert/strict";
import test from "node:test";

import {
  findMatchingDonor,
  normalizeDonorPhone,
  normalizeInstagramUsername,
  validateInlineDonor,
} from "./donor.js";

test("normalizeDonorPhone conserva solamente digitos", () => {
  assert.equal(normalizeDonorPhone("+56 9 1234 5678"), "56912345678");
  assert.equal(normalizeDonorPhone("56-9-1234-5678"), "56912345678");
});

test("normalizeInstagramUsername quita arrobas, espacios y mayusculas", () => {
  assert.equal(normalizeInstagramUsername("  @@Rescate_Esponjosos "), "rescate_esponjosos");
  assert.equal(normalizeInstagramUsername("rescate esponjosos"), "rescateesponjosos");
});

test("findMatchingDonor detecta coincidencias normalizadas", () => {
  const donors = [
    {
      id: 7,
      telefono: "+56 9 1234 5678",
      usuarioInstagram: "@Rescate_Esponjosos",
      email: "DONANTE@EXAMPLE.CL",
    },
  ];

  assert.equal(findMatchingDonor(donors, { telefono: "56912345678" }).donor.id, 7);
  assert.equal(
    findMatchingDonor(donors, { usuarioInstagram: "rescate_esponjosos" }).matchedBy,
    "instagram",
  );
  assert.equal(findMatchingDonor(donors, { email: "donante@example.cl" }).matchedBy, "email");
});

test("validateInlineDonor exige nombre, apellido, teléfono e Instagram", () => {
  const errors = validateInlineDonor({ nombre: "Víctor" });
  assert.equal(errors.nombre, undefined);
  assert.match(errors.apellido, /obligatorio/i);
  assert.match(errors.telefono, /obligatorio/i);
  assert.match(errors.usuarioInstagram, /obligatorio/i);
});

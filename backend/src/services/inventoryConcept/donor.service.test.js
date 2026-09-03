import assert from "node:assert/strict";
import test from "node:test";

import {
  donorHasHistory,
  findDuplicateDonorInCollection,
  normalizeDonorEmailForPersistence,
  normalizeDonorInstagramForPersistence,
  normalizeDonorPhoneForComparison,
} from "./donor.service.js";

test("normalizeDonorEmailForPersistence normaliza vacios a null", () => {
  assert.equal(normalizeDonorEmailForPersistence(""), null);
  assert.equal(normalizeDonorEmailForPersistence("   "), null);
});

test("normalizeDonorEmailForPersistence convierte correo a minusculas", () => {
  assert.equal(
    normalizeDonorEmailForPersistence("Maria.Donante@Fundacion.CL"),
    "maria.donante@fundacion.cl",
  );
});

test("donorHasHistory detecta donaciones, transacciones u ordenes asociadas", () => {
  assert.equal(donorHasHistory({ donation: [{}] }), true);
  assert.equal(donorHasHistory({ transactions: [{}] }), true);
  assert.equal(donorHasHistory({ payment_orders: [{}] }), true);
  assert.equal(donorHasHistory({ donation: [], transactions: [], payment_orders: [] }), false);
});

test("normalizadores de telefono e Instagram generan claves comparables", () => {
  assert.equal(normalizeDonorPhoneForComparison("+56 9 1234 5678"), "56912345678");
  assert.equal(
    normalizeDonorInstagramForPersistence("  @@Rescate_Esponjosos "),
    "rescate_esponjosos",
  );
});

test("findDuplicateDonorInCollection detecta telefono e Instagram normalizados", () => {
  const donors = [
    {
      donante_id: 4,
      email: "donante@example.cl",
      telefono: "+56 9 1234 5678",
      usuario_instagram: "@Rescate_Esponjosos",
    },
  ];

  assert.equal(
    findDuplicateDonorInCollection(donors, { telefono: "56912345678" }).matchedBy,
    "telefono",
  );
  assert.equal(
    findDuplicateDonorInCollection(donors, { usuario_instagram: "rescate_esponjosos" }).matchedBy,
    "instagram",
  );
  assert.equal(
    findDuplicateDonorInCollection(donors, { email: "DONANTE@EXAMPLE.CL" }).matchedBy,
    "email",
  );
});

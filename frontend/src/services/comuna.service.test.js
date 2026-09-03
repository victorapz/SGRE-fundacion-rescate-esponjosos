import test from "node:test";
import assert from "node:assert/strict";

import { normalizeComuna } from "./comuna.service.js";

test("normalizeComuna mapea comuna y su region asociada", () => {
  const result = normalizeComuna({
    id_comuna: 13101,
    nombre: "Santiago",
    codigo: "STGO",
    activo: true,
    region: {
      id_region: 7,
      clave: "RM",
      nombre: "Región Metropolitana de Santiago",
      activo: true,
      orden: 7,
    },
  });

  assert.equal(result.id, 13101);
  assert.equal(result.nombre, "Santiago");
  assert.equal(result.codigo, "STGO");
  assert.equal(result.region.id, 7);
  assert.equal(result.region.codigo, "RM");
  assert.equal(result.region.nombre, "Región Metropolitana de Santiago");
});


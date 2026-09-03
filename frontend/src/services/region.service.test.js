import test from "node:test";
import assert from "node:assert/strict";

import { normalizeRegion } from "./region.service.js";

test("normalizeRegion mapea la respuesta del backend territorial", () => {
  const result = normalizeRegion({
    id_region: 7,
    clave: "RM",
    nombre: "Región Metropolitana de Santiago",
    activo: true,
    orden: 7,
  });

  assert.equal(result.id, 7);
  assert.equal(result.codigo, "RM");
  assert.equal(result.clave, "RM");
  assert.equal(result.nombre, "Región Metropolitana de Santiago");
  assert.equal(result.activo, true);
  assert.equal(result.orden, 7);
});


import assert from "node:assert/strict";
import test from "node:test";

import { mergeHistoricalVeterinarianOption } from "./clinicalForm.shared.js";

test("mergeHistoricalVeterinarianOption agrega opción histórica cuando falta en la lista", () => {
  const items = mergeHistoricalVeterinarianOption(
    [{ id: 1, nombreCompleto: "Vet Activo", activo: true }],
    { id: 9, nombreCompleto: "Vet Histórico" },
  );

  assert.equal(items.length, 2);
  assert.equal(items[1].isHistorical, true);
  assert.equal(items[1].activo, false);
});

test("mergeHistoricalVeterinarianOption no duplica veterinarios existentes", () => {
  const items = mergeHistoricalVeterinarianOption(
    [{ id: 9, nombreCompleto: "Vet Histórico", activo: false }],
    { id: 9, nombreCompleto: "Vet Histórico" },
  );

  assert.equal(items.length, 1);
});

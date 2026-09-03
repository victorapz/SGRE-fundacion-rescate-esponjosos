import test from "node:test";
import assert from "node:assert/strict";
import {
  ANIMAL_ADOPTION_OPTIONS,
  ANIMAL_HEALTH_OPTIONS,
  buildAnimalPayload,
  canSubmitAnimalForm,
  normalizeRegionCatalog,
} from "./animalCore.js";

test("animalCore mantiene enums canonicos para salud y adopción", () => {
  assert.deepEqual(
    ANIMAL_HEALTH_OPTIONS.map((option) => option.value),
    ["SANO", "EN_TRATAMIENTO", "CRITICO"],
  );
  assert.deepEqual(
    ANIMAL_ADOPTION_OPTIONS.map((option) => option.value),
    ["DISPONIBLE", "EN_PROCESO", "ADOPTADO", "NO_APTO"],
  );
});

test("normalizeRegionCatalog ordena y elimina regiones invalidas", () => {
  const regions = normalizeRegionCatalog([
    { id: 2, nombre: "Valparaiso" },
    { id: 0, nombre: "Descartar" },
    { id: 1, nombre: "Metropolitana" },
    { id: "x", nombre: "Invalida" },
  ]);

  assert.deepEqual(regions, [
    { id: 1, nombre: "Metropolitana", clave: "" },
    { id: 2, nombre: "Valparaiso", clave: "" },
  ]);
});

test("canSubmitAnimalForm exige region valida cargada desde catalogo", () => {
  const baseForm = {
    nombre: "Luna",
    especie: "PERRO",
    sexo: "HEMBRA",
    estado_salud_actual: "SANO",
    region_id: "3",
  };

  assert.equal(
    canSubmitAnimalForm({
      form: baseForm,
      regions: [{ id: 1, nombre: "RM" }],
    }),
    false,
  );

  assert.equal(
    canSubmitAnimalForm({
      form: baseForm,
      regions: [{ id: 3, nombre: "Valparaiso" }],
    }),
    true,
  );
});

test("buildAnimalPayload conserva enums canonicos y limpia fecha desconocida", () => {
  const payload = buildAnimalPayload(
    {
      nombre: " Luna ",
      especie: "PERRO",
      sexo: "HEMBRA",
      estado_salud_actual: "EN_TRATAMIENTO",
      estado_adopcion: "NO_APTO",
      region_id: "5",
      tipo_fecha_nacimiento: "DESCONOCIDA",
      fecha_nacimiento: "2025-01-01",
      fecha_llegada_fundacion: "",
      fallecido: false,
      fecha_fallecimiento: "2026-06-01",
    },
    "edit",
  );

  assert.equal(payload.nombre, "Luna");
  assert.equal(payload.estado_salud_actual, "EN_TRATAMIENTO");
  assert.equal(payload.estado_adopcion, "NO_APTO");
  assert.equal(payload.region_id, 5);
  assert.equal(payload.fecha_nacimiento, null);
  assert.equal(payload.fecha_fallecimiento, null);
});

"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import { examCreateValidation } from "./exam.validation.js";
import { hospitalizationCreateValidation } from "./hospitalization.validation.js";
import { procedureCreateValidation } from "./procedure.validation.js";
import {
  veterinarianCreateValidation,
  veterinarianUpdateBodyValidation,
} from "./veterinarian.validation.js";
import { vetClinicUpdateBodyValidation } from "./vet_clinic.validation.js";
import { vetCheckupCreateValidation } from "./vet_checkup.validation.js";

test("examCreateValidation acepta exactamente los campos minimos y veterinario nulo", () => {
  const { error, value } = examCreateValidation.validate({
    fecha_solicitud: "2026-07-03",
    nombre_examen: "Perfil bioquimico",
    motivo: "Control general",
    clinic_id: 1,
    animal_id: 9,
    veterinarian_id: null,
  });

  assert.equal(error, undefined);
  assert.equal(value.veterinarian_id, null);
});

test("hospitalizationCreateValidation exige solo sus campos obligatorios", () => {
  const { error } = hospitalizationCreateValidation.validate({
    fecha_ingreso: "2026-07-03",
    motivo: "Observacion post operatoria",
    clinic_id: 1,
    animal_id: 9,
  });

  assert.match(error?.message || "", /fecha de control postalta/i);
});

test("procedureCreateValidation acepta campos minimos sin veterinario", () => {
  const { error } = procedureCreateValidation.validate({
    fecha_procedimiento: "2026-07-03",
    tipo: "Curacion",
    motivo: "Herida superficial",
    clinic_id: 1,
    animal_id: 9,
    veterinarian_id: null,
  });

  assert.equal(error, undefined);
});

test("vetCheckupCreateValidation exige proximo control posterior y permite peso con coma", () => {
  const { error, value } = vetCheckupCreateValidation.validate({
    fecha: "2026-07-03",
    motivo: "Seguimiento",
    clinic_id: 1,
    animal_id: 9,
    fecha_proximo_control: "2026-07-10",
    peso: "12,5",
  });

  assert.equal(error, undefined);
  assert.equal(value.peso, 12.5);
});

test("vetCheckupCreateValidation rechaza proximo control no posterior", () => {
  const { error } = vetCheckupCreateValidation.validate({
    fecha: "2026-07-03",
    motivo: "Seguimiento",
    clinic_id: 1,
    animal_id: 9,
    fecha_proximo_control: "2026-07-03",
  });

  assert.match(error?.message || "", /revisa las fechas ingresadas/i);
});

test("veterinarian validations aceptan clinic_ids y arreglo vacio", () => {
  const { error: createError } = veterinarianCreateValidation.validate({
    nombre: "Maria-Jose",
    apellido: "O'Ryan",
    email: "maria@fundacion.cl",
    telefono: "+56912345678",
    clinic_ids: [1, 2],
  });

  const { error: updateError } = veterinarianUpdateBodyValidation.validate({
    clinic_ids: [],
  });

  assert.equal(createError, undefined);
  assert.equal(updateError, undefined);
});

test("vetClinicUpdateBodyValidation acepta veterinarian_ids vacio", () => {
  const { error } = vetClinicUpdateBodyValidation.validate({
    veterinarian_ids: [],
  });

  assert.equal(error, undefined);
});

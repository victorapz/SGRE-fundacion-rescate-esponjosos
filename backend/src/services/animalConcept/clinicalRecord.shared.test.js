import assert from "node:assert/strict";
import test from "node:test";

import {
  VETERINARIAN_CLINIC_MISMATCH_MESSAGE,
  resolveVeterinarianForClinic,
} from "./clinicalRecord.shared.js";

test("resolveVeterinarianForClinic acepta relacion intermedia activa", async () => {
  const manager = {
    getRepository(entity) {
      if (entity?.options?.name === "Veterinarian" || entity?.name === "Veterinarian") {
        return {
          async findOne() {
            return {
              id_veterinario: 4,
              activo: true,
              clinic: null,
              veterinarianClinics: [{ clinic: { id_clinica: 9 } }],
            };
          },
        };
      }

      return {
        async findOne() {
          return null;
        },
        create(data) {
          return data;
        },
        async save() {},
      };
    },
  };

  const veterinarian = await resolveVeterinarianForClinic(manager, 9, 4);
  assert.equal(veterinarian.id_veterinario, 4);
});

test("resolveVeterinarianForClinic crea relacion intermedia idempotente cuando solo existe legacy clinic", async () => {
  const savedRelations = [];
  const manager = {
    getRepository(entity) {
      if (entity?.options?.name === "Veterinarian" || entity?.name === "Veterinarian") {
        return {
          async findOne() {
            return {
              id_veterinario: 8,
              activo: true,
              clinic: { id_clinica: 3 },
              veterinarianClinics: [],
            };
          },
        };
      }

      return {
        async findOne() {
          return null;
        },
        create(data) {
          return data;
        },
        async save(data) {
          savedRelations.push(data);
        },
      };
    },
  };

  await resolveVeterinarianForClinic(manager, 3, 8);

  assert.equal(savedRelations.length, 1);
  assert.equal(savedRelations[0].clinic.id_clinica, 3);
});

test("resolveVeterinarianForClinic rechaza veterinarios incompatibles o inactivos", async () => {
  const manager = {
    getRepository() {
      return {
        async findOne() {
          return {
            id_veterinario: 5,
            activo: false,
            clinic: null,
            veterinarianClinics: [],
          };
        },
        create(data) {
          return data;
        },
        async save() {},
      };
    },
  };

  await assert.rejects(
    () => resolveVeterinarianForClinic(manager, 2, 5),
    new RegExp(VETERINARIAN_CLINIC_MISMATCH_MESSAGE),
  );
});

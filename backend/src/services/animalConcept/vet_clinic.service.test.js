import assert from "node:assert/strict";
import test from "node:test";

import { syncClinicVeterinarians } from "./vet_clinic.service.js";

test("syncClinicVeterinarians permite arreglo vacio y ajusta clinic legacy al quitar asociaciones", async () => {
  const savedVeterinarians = [];
  const removedRelations = [];
  const veterinarianRepository = {
    async find() {
      return [];
    },
    create(data) {
      return data;
    },
    async save(entity) {
      savedVeterinarians.push(entity);
      return entity;
    },
  };

  const veterinarianClinicRepository = {
    async find({ where }) {
      if (where?.clinic) {
        return [
          {
            veterinarian: {
              id_veterinario: 7,
              clinic: { id_clinica: 3 },
            },
            clinic: { id_clinica: 3 },
          },
        ];
      }

      return [];
    },
    create(data) {
      return data;
    },
    async save() {},
    async remove(items) {
      removedRelations.push(...items);
    },
  };

  const manager = {
    getRepository(entity) {
      if (entity?.options?.name === "Veterinarian" || entity?.name === "Veterinarian") {
        return veterinarianRepository;
      }

      return veterinarianClinicRepository;
    },
  };

  await syncClinicVeterinarians(manager, 3, []);

  assert.equal(removedRelations.length, 1);
  assert.equal(savedVeterinarians.length, 1);
  assert.equal(savedVeterinarians[0].id_veterinario, 7);
  assert.equal(savedVeterinarians[0].clinic, null);
});

test("syncClinicVeterinarians valida veterinarios activos antes de sincronizar", async () => {
  const veterinarianRepository = {
    async find() {
      return [{ id_veterinario: 1, activo: true, clinic: null }];
    },
    create(data) {
      return data;
    },
    async save() {},
  };

  const veterinarianClinicRepository = {
    async find() {
      return [];
    },
    create(data) {
      return data;
    },
    async save() {},
    async remove() {},
  };

  const manager = {
    getRepository(entity) {
      if (entity?.options?.name === "Veterinarian" || entity?.name === "Veterinarian") {
        return veterinarianRepository;
      }

      return veterinarianClinicRepository;
    },
  };

  await assert.rejects(
    () => syncClinicVeterinarians(manager, 3, [1, 2]),
    /Solo puedes asociar veterinarios activos/i,
  );
});

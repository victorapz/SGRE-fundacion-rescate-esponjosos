import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppDataSource } from "../../config/configDb.js";
import {
  createVeterinarianService,
  getLegacyClinicIdFromClinicIds,
  normalizeVeterinarianClinicIdsInput,
  syncVeterinarianClinicMemberships,
} from "./veterinarian.service.js";

const originalTransaction = AppDataSource.transaction;

afterEach(() => {
  AppDataSource.transaction = originalTransaction;
});

test("normalizeVeterinarianClinicIdsInput prioriza clinic_ids y admite arreglo vacio", () => {
  assert.deepEqual(
    normalizeVeterinarianClinicIdsInput({ clinic_ids: [3, 3, 5], clinic_id: 2 }),
    { shouldSync: true, clinicIds: [3, 5] },
  );

  assert.deepEqual(
    normalizeVeterinarianClinicIdsInput({ clinic_ids: [] }),
    { shouldSync: true, clinicIds: [] },
  );

  assert.deepEqual(
    normalizeVeterinarianClinicIdsInput({ clinic_id: null }),
    { shouldSync: true, clinicIds: [] },
  );
});

test("getLegacyClinicIdFromClinicIds toma el primer id valido o null", () => {
  assert.equal(getLegacyClinicIdFromClinicIds([9, 4]), 9);
  assert.equal(getLegacyClinicIdFromClinicIds([]), null);
});

test("syncVeterinarianClinicMemberships crea y elimina relaciones tras validar clinicas activas", async () => {
  const created = [];
  const removed = [];
  const veterinarianClinicRepository = {
    async find() {
      return [
        { clinic: { id_clinica: 4 } },
      ];
    },
    create(data) {
      return data;
    },
    async save(items) {
      created.push(...items);
    },
    async remove(items) {
      removed.push(...items);
    },
  };

  const clinicRepository = {
    async find() {
      return [
        { id_clinica: 2, activo: true },
        { id_clinica: 3, activo: true },
      ];
    },
  };

  const manager = {
    getRepository(entity) {
      if (entity?.name === "VetClinic" || entity?.options?.name === "VetClinic") {
        return clinicRepository;
      }
      return veterinarianClinicRepository;
    },
  };

  await syncVeterinarianClinicMemberships(manager, 8, [2, 3, 3]);

  assert.equal(created.length, 2);
  assert.deepEqual(
    created.map((item) => Number(item.clinic.id_clinica)).sort((a, b) => a - b),
    [2, 3],
  );
  assert.equal(removed.length, 1);
  assert.equal(Number(removed[0].clinic.id_clinica), 4);
});

test("syncVeterinarianClinicMemberships rechaza clinicas inexistentes o inactivas", async () => {
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

  const missingClinicManager = {
    getRepository(entity) {
      if (entity?.name === "VetClinic" || entity?.options?.name === "VetClinic") {
        return {
          async find() {
            return [{ id_clinica: 1, activo: true }];
          },
        };
      }
      return veterinarianClinicRepository;
    },
  };

  await assert.rejects(
    () => syncVeterinarianClinicMemberships(missingClinicManager, 4, [1, 2]),
    /Una o mas clinicas seleccionadas no existen/i,
  );

  const inactiveClinicManager = {
    getRepository(entity) {
      if (entity?.name === "VetClinic" || entity?.options?.name === "VetClinic") {
        return {
          async find() {
            return [{ id_clinica: 5, activo: false }];
          },
        };
      }
      return veterinarianClinicRepository;
    },
  };

  await assert.rejects(
    () => syncVeterinarianClinicMemberships(inactiveClinicManager, 4, [5]),
    /Solo puedes asociar clinicas activas/i,
  );
});

test("createVeterinarianService permite crear un veterinario sin clinicas", async () => {
  const savedItems = [];
  const veterinarianRepository = {
    async findOne({ where }) {
      if (where?.id_veterinario) {
        return savedItems.find((item) => Number(item.id_veterinario) === Number(where.id_veterinario)) || null;
      }

      if (where?.email || where?.telefono) {
        return null;
      }

      return null;
    },
    create(data) {
      return { ...data };
    },
    async save(entity) {
      const saved = {
        id_veterinario: entity.id_veterinario || 1,
        ...entity,
        clinic: entity.clinic || null,
        veterinarianClinics: [],
      };
      savedItems[0] = saved;
      return saved;
    },
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

  const clinicRepository = {
    async find() {
      return [];
    },
  };

  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository(entity) {
        if (entity?.name === "Veterinarian" || entity?.options?.name === "Veterinarian") {
          return veterinarianRepository;
        }
        if (entity?.name === "VetClinic" || entity?.options?.name === "VetClinic") {
          return clinicRepository;
        }
        return veterinarianClinicRepository;
      },
    });

  const [created, createError] = await createVeterinarianService({
    nombre: "Maria",
    apellido: "Perez",
    email: "maria@fundacion.cl",
    telefono: "+56912345678",
    activo: true,
    clinic_ids: [],
  });

  assert.equal(createError, null);
  assert.equal(created.nombre, "Maria");
  assert.deepEqual(created.clinics, []);
  assert.equal(created.clinic, null);
});

"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import Animal from "../../entities/animalConcept/animal.entity.js";
import AnimalDiets from "../../entities/animalConcept/animal_diets.entity.js";
import AnimalProfile from "../../entities/animalConcept/animal_profile.entity.js";
import Exam from "../../entities/animalConcept/exam.entity.js";
import Hospitalization from "../../entities/animalConcept/hospitalization.entity.js";
import IntakeRecord from "../../entities/animalConcept/intake_record.entity.js";
import Procedure from "../../entities/animalConcept/procedure.entity.js";
import Region from "../../entities/region.entity.js";
import FosterAssignment from "../../entities/foster_assignment.entity.js";
import Sponsorship from "../../entities/financialConcept/sponsorship.entity.js";
import FileAsset from "../../entities/file_asset.entity.js";
import VetCheckup from "../../entities/animalConcept/vet_checkup.entity.js";
import { AppDataSource } from "../../config/configDb.js";
import {
  createAnimalService,
  deleteAnimalService,
  getAnimalService,
  updateAnimalService,
} from "./animal.service.js";

const REGION_NOT_AVAILABLE_MESSAGE =
  "La región seleccionada no existe o ya no está disponible.";
const DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar el animal porque posee historial o registros asociados. Posee ficha de ingreso, registros clínicos o archivos asociados.";

function createCountRepository(count = 0) {
  return {
    async count() {
      return count;
    },
  };
}

function createFindRepository(items = []) {
  return {
    async find() {
      return items;
    },
  };
}

function createAnimalRepository(overrides = {}) {
  return {
    create: overrides.create || ((payload) => payload),
    save: overrides.save || (async (payload) => ({
      id_animal: 1,
      ...payload,
    })),
    findOne: overrides.findOne || (async () => null),
    remove: overrides.remove || (async (payload) => payload),
  };
}

function withRepositories(repositoryEntries, run) {
  const originalGetRepository = AppDataSource.getRepository.bind(AppDataSource);
  AppDataSource.getRepository = (entity) => {
    if (repositoryEntries.has(entity)) {
      return repositoryEntries.get(entity);
    }

    throw new Error(`Repositorio no configurado para test: ${entity?.options?.name || entity}`);
  };

  return Promise.resolve()
    .then(run)
    .finally(() => {
      AppDataSource.getRepository = originalGetRepository;
    });
}

test("createAnimalService rechaza region inexistente con mensaje humano", async () => {
  const repositories = new Map([
    [Animal, createAnimalRepository()],
    [Region, { findOne: async () => null }],
  ]);

  await withRepositories(repositories, async () => {
    const [animal, error] = await createAnimalService({
      nombre: "Luna",
      sexo: "HEMBRA",
      especie: "PERRO",
      estado_salud_actual: "SANO",
      region_id: 9999,
    });

    assert.equal(animal, null);
    assert.equal(error, REGION_NOT_AVAILABLE_MESSAGE);
  });
});

test("createAnimalService convierte fallo FK de region en mensaje humano", async () => {
  const repositories = new Map([
    [Animal, createAnimalRepository({
      save: async () => {
        const error = new Error("fk");
        error.code = "23503";
        error.constraint = "fk_animals_region_id";
        throw error;
      },
    })],
    [Region, { findOne: async () => ({ id_region: 5 }) }],
  ]);

  await withRepositories(repositories, async () => {
    const [animal, error] = await createAnimalService({
      nombre: "Luna",
      sexo: "HEMBRA",
      especie: "PERRO",
      estado_salud_actual: "EN_TRATAMIENTO",
      region_id: 5,
    });

    assert.equal(animal, null);
    assert.equal(error, REGION_NOT_AVAILABLE_MESSAGE);
  });
});

test("updateAnimalService rechaza region inexistente sin guardar la entidad", async () => {
  let saveCalled = false;
  const repositories = new Map([
    [Animal, createAnimalRepository({
      findOne: async () => ({
        id_animal: 4,
        nombre: "Luna",
        sexo: "HEMBRA",
        especie: "PERRO",
        estado_salud_actual: "SANO",
        intakeRecords: [],
        region: { id_region: 1 },
      }),
      save: async () => {
        saveCalled = true;
      },
    })],
    [Region, { findOne: async () => null }],
  ]);

  await withRepositories(repositories, async () => {
    const [animal, error] = await updateAnimalService(
      { id: 4 },
      { region_id: 404 },
    );

    assert.equal(animal, null);
    assert.equal(error, REGION_NOT_AVAILABLE_MESSAGE);
    assert.equal(saveCalled, false);
  });
});

test("deleteAnimalService bloquea borrado fisico cuando existen dependencias", async () => {
  let removeCalled = false;
  const repositories = new Map([
    [Animal, createAnimalRepository({
      findOne: async () => ({ id_animal: 3, nombre: "Nube" }),
      remove: async () => {
        removeCalled = true;
      },
    })],
    [AnimalProfile, createCountRepository(0)],
    [IntakeRecord, createCountRepository(1)],
    [AnimalDiets, createCountRepository(0)],
    [Exam, createCountRepository(0)],
    [Hospitalization, createCountRepository(0)],
    [Procedure, createCountRepository(0)],
    [VetCheckup, createCountRepository(0)],
    [FosterAssignment, createCountRepository(0)],
    [Sponsorship, createCountRepository(0)],
    [FileAsset, createCountRepository(0)],
  ]);

  await withRepositories(repositories, async () => {
    const [deletedAnimal, error] = await deleteAnimalService({ id: 3 });

    assert.equal(deletedAnimal, null);
    assert.equal(error, DELETE_BLOCKED_MESSAGE);
    assert.equal(removeCalled, false);
  });
});

test("getAnimalService devuelve el proximo control mas cercano entre control y postalta", async () => {
  const repositories = new Map([
    [Animal, createAnimalRepository({
      findOne: async () => ({
        id_animal: 8,
        nombre: "Rayo",
        sexo: "MACHO",
        especie: "PERRO",
        estado_salud_actual: "ESTABLE",
        intakeRecords: [],
        region: { nombre: "Biobio" },
      }),
    })],
    [Hospitalization, createFindRepository([
      { fecha_control_post_alta: "2099-08-01" },
      { fecha_control_post_alta: "2099-07-20" },
    ])],
    [VetCheckup, createFindRepository([
      { fecha_proximo_control: "2099-07-10" },
      { fecha_proximo_control: "2099-07-18" },
    ])],
  ]);

  await withRepositories(repositories, async () => {
    const [animal, error] = await getAnimalService({ id: 8 });

    assert.equal(error, null);
    assert.equal(animal?.proximo_control, "2099-07-10");
  });
});

test("getAnimalService ignora fechas pasadas o invalidas al calcular proximo control", async () => {
  const repositories = new Map([
    [Animal, createAnimalRepository({
      findOne: async () => ({
        id_animal: 9,
        nombre: "Mora",
        sexo: "HEMBRA",
        especie: "GATO",
        estado_salud_actual: "ESTABLE",
        intakeRecords: [],
        region: { nombre: "Maule" },
      }),
    })],
    [Hospitalization, createFindRepository([
      { fecha_control_post_alta: "ayer" },
      { fecha_control_post_alta: "2000-01-01" },
    ])],
    [VetCheckup, createFindRepository([
      { fecha_proximo_control: null },
      { fecha_proximo_control: "2001-01-01" },
    ])],
  ]);

  await withRepositories(repositories, async () => {
    const [animal, error] = await getAnimalService({ id: 9 });

    assert.equal(error, null);
    assert.equal(animal?.proximo_control, null);
  });
});

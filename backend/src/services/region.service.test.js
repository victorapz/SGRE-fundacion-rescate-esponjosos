import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppDataSource } from "../config/configDb.js";
import {
  createRegionService,
  getRegionsService,
  normalizeString,
  parseOptionalBoolean,
  toggleRegionActiveService,
} from "./region.service.js";

const originalTransaction = AppDataSource.transaction;
const originalGetRepository = AppDataSource.getRepository;

function createRegionRepository(seed = []) {
  const items = seed.map((item) => ({ ...item }));

  return {
    items,
    async find() {
      return items.map((item) => ({ ...item }));
    },
    async findOne({ where }) {
      return items.find((item) => Number(item.id_region) === Number(where.id_region)) || null;
    },
    create(data) {
      return { ...data };
    },
    async save(entity) {
      if (entity.id_region) {
        const index = items.findIndex((item) => Number(item.id_region) === Number(entity.id_region));
        if (index >= 0) {
          items[index] = { ...items[index], ...entity };
          return { ...items[index] };
        }
      }

      const nextId = items.length > 0
        ? Math.max(...items.map((item) => Number(item.id_region))) + 1
        : 1;
      const saved = { ...entity, id_region: nextId };
      items.push(saved);
      return { ...saved };
    },
  };
}

function withRegionRepository(repository) {
  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository() {
        return repository;
      },
    });
  AppDataSource.getRepository = () => repository;
}

afterEach(() => {
  AppDataSource.transaction = originalTransaction;
  AppDataSource.getRepository = originalGetRepository;
});

test("helpers de region normalizan strings y booleanos opcionales", () => {
  assert.equal(normalizeString(" Región Metropolitana "), "region metropolitana");
  assert.equal(parseOptionalBoolean(undefined), undefined);
  assert.equal(parseOptionalBoolean("true"), true);
  assert.equal(parseOptionalBoolean("false"), false);
});

test("createRegionService crea una region valida y evita duplicados por nombre normalizado", async () => {
  const repository = createRegionRepository([
    { id_region: 1, nombre: "Región de Tarapaca", clave: "TA", activo: true, orden: 1 },
  ]);
  withRegionRepository(repository);

  const [created, createError] = await createRegionService({
    nombre: "Región de Atacama",
    clave: "AT",
    activo: true,
    orden: 4,
  });

  assert.equal(createError, null);
  assert.equal(created.nombre, "Región de Atacama");
  assert.equal(created.codigo, "AT");

  const [, duplicateError] = await createRegionService({
    nombre: "Región de Tarapacá",
    clave: "TAR",
  });

  assert.equal(duplicateError, "Ya existe una región con ese nombre.");
});

test("getRegionsService filtra por activo y busqueda", async () => {
  const repository = createRegionRepository([
    { id_region: 1, nombre: "Región Metropolitana de Santiago", clave: "RM", activo: true, orden: 7 },
    { id_region: 2, nombre: "Región de Valparaiso", clave: "VAL", activo: false, orden: 6 },
  ]);
  withRegionRepository(repository);

  const [activeRegions] = await getRegionsService({ active: true });
  const [searchedRegions] = await getRegionsService({ search: "valpa" });

  assert.equal(activeRegions.length, 1);
  assert.equal(activeRegions[0].codigo, "RM");
  assert.equal(searchedRegions.length, 1);
  assert.equal(searchedRegions[0].codigo, "VAL");
});

test("toggleRegionActiveService alterna el estado de la region", async () => {
  const repository = createRegionRepository([
    { id_region: 7, nombre: "Región Metropolitana de Santiago", clave: "RM", activo: true, orden: 7 },
  ]);
  withRegionRepository(repository);

  const [toggled, toggleError] = await toggleRegionActiveService({ id_region: 7 });

  assert.equal(toggleError, null);
  assert.equal(toggled.activo, false);
});

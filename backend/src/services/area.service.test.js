import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppDataSource } from "../config/configDb.js";
import {
  createAreaService,
  getAreasService,
  toggleAreaActiveService,
  updateAreaService,
} from "./area.service.js";

const originalTransaction = AppDataSource.transaction;
const originalGetRepository = AppDataSource.getRepository;

function createAreaRepository(seed = []) {
  const items = seed.map((item) => ({ ...item }));

  return {
    items,
    async find() {
      return items.map((item) => ({ ...item }));
    },
    async findOne({ where }) {
      return items.find((item) => Number(item.id_area) === Number(where.id_area)) || null;
    },
    create(data) {
      return { ...data };
    },
    async save(entity) {
      if (entity.id_area) {
        const index = items.findIndex((item) => Number(item.id_area) === Number(entity.id_area));
        if (index >= 0) {
          items[index] = { ...items[index], ...entity };
          return { ...items[index] };
        }
      }

      const nextId = items.length > 0
        ? Math.max(...items.map((item) => Number(item.id_area))) + 1
        : 1;
      const saved = { ...entity, id_area: nextId };
      items.push(saved);
      return { ...saved };
    },
  };
}

function withRepositories(areaRepository) {
  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository() {
        return areaRepository;
      },
    });
  AppDataSource.getRepository = () => areaRepository;
}

afterEach(() => {
  AppDataSource.transaction = originalTransaction;
  AppDataSource.getRepository = originalGetRepository;
});

test("createAreaService crea un area activa y evita duplicados", async () => {
  const repository = createAreaRepository([
    { id_area: 1, nombre: "Contenido", clave: "CON", descripcion: "Area de contenido", activo: true },
  ]);
  withRepositories(repository);

  const [created, createError] = await createAreaService({
    nombre: "Rescate",
    clave: "RES",
    descripcion: "Area de rescate",
    activo: true,
  });

  assert.equal(createError, null);
  assert.equal(created.nombre, "Rescate");
  assert.equal(created.clave, "RES");
  assert.equal(created.activo, true);

  const [, duplicateError] = await createAreaService({
    nombre: "contenido",
    clave: "CONT",
    descripcion: "Duplicada",
  });

  assert.equal(duplicateError, "Ya existe un área con ese nombre.");
});

test("getAreasService filtra por activo y busqueda", async () => {
  const repository = createAreaRepository([
    { id_area: 1, nombre: "Contenido", clave: "CON", descripcion: "Area de contenido", activo: true },
    { id_area: 2, nombre: "Rescate", clave: "RES", descripcion: "Area de rescate", activo: false },
  ]);
  withRepositories(repository);

  const [activeAreas] = await getAreasService({ active: true });
  const [searchedAreas] = await getAreasService({ search: "res" });

  assert.deepEqual(activeAreas.map((item) => item.clave), ["CON"]);
  assert.deepEqual(searchedAreas.map((item) => item.clave), ["RES"]);
});

test("updateAreaService actualiza datos y valida clave duplicada", async () => {
  const repository = createAreaRepository([
    { id_area: 1, nombre: "Contenido", clave: "CON", descripcion: "Area de contenido", activo: true },
    { id_area: 2, nombre: "Rescate", clave: "RES", descripcion: "Area de rescate", activo: true },
  ]);
  withRepositories(repository);

  const [updated, updateError] = await updateAreaService(
    { id_area: 2 },
    { nombre: "Rescate y rehabilitación", descripcion: "Nueva descripcion" },
  );

  assert.equal(updateError, null);
  assert.equal(updated.nombre, "Rescate y rehabilitación");

  const [, duplicateError] = await updateAreaService({ id_area: 2 }, { clave: "CON" });
  assert.equal(duplicateError, "Ya existe un área con esa clave.");
});

test("toggleAreaActiveService alterna estado", async () => {
  const repository = createAreaRepository([
    { id_area: 1, nombre: "Contenido", clave: "CON", descripcion: "Area de contenido", activo: true },
  ]);
  withRepositories(repository);

  const [toggled, toggleError] = await toggleAreaActiveService({ id_area: 1 });

  assert.equal(toggleError, null);
  assert.equal(toggled.activo, false);
});

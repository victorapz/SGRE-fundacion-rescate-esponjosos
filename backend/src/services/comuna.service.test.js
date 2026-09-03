import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { AppDataSource } from "../config/configDb.js";
import {
  createComunaService,
  getComunasService,
  toggleComunaActiveService,
} from "./comuna.service.js";

const originalTransaction = AppDataSource.transaction;
const originalGetRepository = AppDataSource.getRepository;

function createRegionRepository(seed = []) {
  const items = seed.map((item) => ({ ...item }));
  return {
    async findOne({ where }) {
      return items.find((item) => Number(item.id_region) === Number(where.id_region)) || null;
    },
  };
}

function createComunaRepository(seed = []) {
  const items = seed.map((item) => ({
    ...item,
    region: item.region ? { ...item.region } : null,
  }));

  return {
    items,
    async find() {
      return items.map((item) => ({
        ...item,
        region: item.region ? { ...item.region } : null,
      }));
    },
    async findOne({ where }) {
      const found = items.find((item) => Number(item.id_comuna) === Number(where.id_comuna)) || null;
      return found
        ? {
            ...found,
            region: found.region ? { ...found.region } : null,
          }
        : null;
    },
    create(data) {
      return { ...data };
    },
    async save(entity) {
      if (entity.id_comuna) {
        const index = items.findIndex((item) => Number(item.id_comuna) === Number(entity.id_comuna));
        if (index >= 0) {
          items[index] = {
            ...items[index],
            ...entity,
            region: entity.region?.id_region
              ? { ...(items[index].region || {}), id_region: entity.region.id_region }
              : entity.region || items[index].region,
          };
          return { ...items[index] };
        }
      }

      const nextId = items.length > 0
        ? Math.max(...items.map((item) => Number(item.id_comuna))) + 1
        : 1;
      const saved = { ...entity, id_comuna: nextId };
      items.push(saved);
      return { ...saved };
    },
  };
}

function withRepositories({ regionRepository, comunaRepository }) {
  AppDataSource.transaction = async (callback) =>
    callback({
      getRepository(target) {
        if (target?.options?.name === "Region") return regionRepository;
        return comunaRepository;
      },
    });

  AppDataSource.getRepository = (target) => {
    if (target?.options?.name === "Region") return regionRepository;
    return comunaRepository;
  };
}

afterEach(() => {
  AppDataSource.transaction = originalTransaction;
  AppDataSource.getRepository = originalGetRepository;
});

test("createComunaService rechaza crear una comuna activa en una region inactiva", async () => {
  const regionRepository = createRegionRepository([
    { id_region: 9, nombre: "Región del Maule", clave: "MAU", activo: false, orden: 9 },
  ]);
  const comunaRepository = createComunaRepository([]);
  withRepositories({ regionRepository, comunaRepository });

  const [, createError] = await createComunaService({
    nombre: "Talca",
    region_id: 9,
    activo: true,
  });

  assert.equal(createError, "No puedes crear una comuna activa dentro de una región inactiva.");
});

test("getComunasService filtra por region y activo", async () => {
  const region = { id_region: 7, nombre: "Región Metropolitana de Santiago", clave: "RM", activo: true, orden: 7 };
  const otherRegion = { id_region: 6, nombre: "Región de Valparaiso", clave: "VAL", activo: true, orden: 6 };
  const regionRepository = createRegionRepository([region, otherRegion]);
  const comunaRepository = createComunaRepository([
    { id_comuna: 1, nombre: "Santiago", codigo: null, activo: true, region },
    { id_comuna: 2, nombre: "Providencia", codigo: null, activo: false, region },
    { id_comuna: 3, nombre: "Valparaiso", codigo: null, activo: true, region: otherRegion },
  ]);
  withRepositories({ regionRepository, comunaRepository });

  const [filtered] = await getComunasService({ region_id: 7, active: true });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].nombre, "Santiago");
});

test("toggleComunaActiveService bloquea reactivar comunas si la region sigue inactiva", async () => {
  const regionRepository = createRegionRepository([
    { id_region: 7, nombre: "Región Metropolitana de Santiago", clave: "RM", activo: false, orden: 7 },
  ]);
  const comunaRepository = createComunaRepository([
    {
      id_comuna: 15,
      nombre: "Santiago",
      codigo: null,
      activo: false,
      region: { id_region: 7, nombre: "Región Metropolitana de Santiago", clave: "RM", activo: false, orden: 7 },
    },
  ]);
  withRepositories({ regionRepository, comunaRepository });

  const [, toggleError] = await toggleComunaActiveService({ id_comuna: 15 });

  assert.equal(
    toggleError,
    "No puedes activar una comuna mientras su región permanezca inactiva.",
  );
});

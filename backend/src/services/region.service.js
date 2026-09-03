"use strict";

import { AppDataSource } from "../config/configDb.js";
import Region from "../entities/region.entity.js";

function normalizeString(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") return value;
  return String(value).trim().toLowerCase() === "true";
}

function mapRegion(region) {
  if (!region) return null;

  return {
    id_region: region.id_region,
    clave: region.clave || "",
    codigo: region.clave || "",
    nombre: region.nombre || "",
    activo: region.activo !== undefined ? Boolean(region.activo) : true,
    orden: Number(region.orden || 0),
    createdAt: region.createdAt || null,
    updatedAt: region.updatedAt || null,
  };
}

async function findRegionById(repository, id) {
  return repository.findOne({
    where: { id_region: Number(id) },
  });
}

async function ensureUniqueRegion(repository, { nombre, clave, excludingId = null }) {
  const regions = await repository.find();
  const normalizedNombre = normalizeString(nombre);
  const normalizedClave = normalizeString(clave);

  const duplicateName = regions.find(
    (item) =>
      Number(item.id_region) !== Number(excludingId)
      && normalizeString(item.nombre) === normalizedNombre,
  );

  if (duplicateName) {
    throw new Error("Ya existe una región con ese nombre.");
  }

  const duplicateCode = regions.find(
    (item) =>
      Number(item.id_region) !== Number(excludingId)
      && normalizeString(item.clave) === normalizedClave,
  );

  if (duplicateCode) {
    throw new Error("Ya existe una región con ese código.");
  }
}

export async function createRegionService(body) {
  try {
    const region = await AppDataSource.transaction(async (manager) => {
      const regionRepository = manager.getRepository(Region);
      const nombre = body.nombre.trim();
      const clave = body.clave.trim().toUpperCase();

      await ensureUniqueRegion(regionRepository, { nombre, clave });

      const created = regionRepository.create({
        nombre,
        clave,
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        orden: Number(body.orden || 0),
      });

      const saved = await regionRepository.save(created);
      return findRegionById(regionRepository, saved.id_region);
    });

    return [mapRegion(region), null];
  } catch (error) {
    console.error("Error al crear región:", error);
    return [null, error.message || "Error interno al crear la región"];
  }
}

export async function getRegionService(query) {
  try {
    const regionRepository = AppDataSource.getRepository(Region);
    const region = await findRegionById(regionRepository, query.id_region);

    if (!region) return [null, "Región no encontrada."];

    return [mapRegion(region), null];
  } catch (error) {
    console.error("Error al obtener región:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getRegionsService(query = {}) {
  try {
    const regionRepository = AppDataSource.getRepository(Region);
    const search = normalizeString(query.search);
    const activeFilter = parseOptionalBoolean(query.active);
    const includeInactive = parseOptionalBoolean(query.includeInactive);
    const page = Number(query.page || 0);
    const limit = Number(query.limit || 0);

    let regions = await regionRepository.find({
      order: {
        orden: "ASC",
        nombre: "ASC",
      },
    });

    if (activeFilter !== undefined) {
      regions = regions.filter((item) => Boolean(item.activo) === activeFilter);
    } else if (includeInactive === false) {
      regions = regions.filter((item) => Boolean(item.activo));
    }

    if (search) {
      regions = regions.filter((item) =>
        [item.nombre, item.clave].some((value) => normalizeString(value).includes(search)),
      );
    }

    if (page > 0 && limit > 0) {
      const start = (page - 1) * limit;
      regions = regions.slice(start, start + limit);
    }

    return [regions.map(mapRegion), null];
  } catch (error) {
    console.error("Error al obtener regiones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateRegionService(query, body) {
  try {
    const region = await AppDataSource.transaction(async (manager) => {
      const regionRepository = manager.getRepository(Region);
      const regionFound = await findRegionById(regionRepository, query.id_region);

      if (!regionFound) {
        throw new Error("Región no encontrada.");
      }

      const nextNombre = body.nombre !== undefined ? body.nombre.trim() : regionFound.nombre;
      const nextClave =
        body.clave !== undefined ? body.clave.trim().toUpperCase() : regionFound.clave;

      if (body.nombre !== undefined || body.clave !== undefined) {
        await ensureUniqueRegion(regionRepository, {
          nombre: nextNombre,
          clave: nextClave,
          excludingId: regionFound.id_region,
        });
      }

      if (body.nombre !== undefined) regionFound.nombre = nextNombre;
      if (body.clave !== undefined) regionFound.clave = nextClave;
      if (body.activo !== undefined) regionFound.activo = Boolean(body.activo);
      if (body.orden !== undefined) regionFound.orden = Number(body.orden);

      await regionRepository.save(regionFound);
      return findRegionById(regionRepository, regionFound.id_region);
    });

    return [mapRegion(region), null];
  } catch (error) {
    console.error("Error al actualizar región:", error);
    return [null, error.message || "Error interno al actualizar la región"];
  }
}

export async function toggleRegionActiveService(query) {
  try {
    const region = await AppDataSource.transaction(async (manager) => {
      const regionRepository = manager.getRepository(Region);
      const regionFound = await findRegionById(regionRepository, query.id_region);

      if (!regionFound) {
        throw new Error("Región no encontrada.");
      }

      regionFound.activo = !Boolean(regionFound.activo);
      await regionRepository.save(regionFound);
      return findRegionById(regionRepository, regionFound.id_region);
    });

    return [mapRegion(region), null];
  } catch (error) {
    console.error("Error al cambiar estado de la región:", error);
    return [null, error.message || "Error interno al cambiar el estado de la región"];
  }
}

export { mapRegion, normalizeString, parseOptionalBoolean };

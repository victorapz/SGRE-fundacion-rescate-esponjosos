"use strict";

import { AppDataSource } from "../config/configDb.js";
import Area from "../entities/area.entity.js";
import Task from "../entities/task.entity.js";
import User from "../entities/user.entity.js";
import UserArea from "../entities/user_area.entity.js";
import { normalizeString, parseOptionalBoolean } from "./region.service.js";

function mapArea(area) {
  if (!area) return null;

  return {
    id_area: area.id_area,
    id: area.id_area,
    nombre: area.nombre || "",
    clave: area.clave || "",
    descripcion: area.descripcion || "",
    activo: area.activo !== undefined ? Boolean(area.activo) : true,
    createdAt: area.createdAt || null,
    updatedAt: area.updatedAt || null,
  };
}

async function findAreaById(repository, id) {
  return repository.findOne({
    where: { id_area: Number(id) },
  });
}

async function ensureUniqueArea(repository, { nombre, clave, excludingId = null }) {
  const areas = await repository.find();
  const normalizedNombre = normalizeString(nombre);
  const normalizedClave = normalizeString(clave);

  const duplicateName = areas.find(
    (item) =>
      Number(item.id_area) !== Number(excludingId)
      && normalizeString(item.nombre) === normalizedNombre,
  );

  if (duplicateName) {
    throw new Error("Ya existe un área con ese nombre.");
  }

  const duplicateKey = areas.find(
    (item) =>
      Number(item.id_area) !== Number(excludingId)
      && normalizeString(item.clave) === normalizedClave,
  );

  if (duplicateKey) {
    throw new Error("Ya existe un área con esa clave.");
  }
}

async function getAreaUsageCounts(manager, areaId) {
  const userRepository = manager.getRepository(User);
  const userAreaRepository = manager.getRepository(UserArea);
  const taskRepository = manager.getRepository(Task);

  const [legacyUsers, userAreas, tasks] = await Promise.all([
    userRepository.count({ where: { area: { id_area: Number(areaId) } } }),
    userAreaRepository.count({ where: { area: { id_area: Number(areaId) } } }),
    taskRepository.count({ where: { area: { id_area: Number(areaId) } } }),
  ]);

  return { legacyUsers, userAreas, tasks };
}

export async function createAreaService(body) {
  try {
    const area = await AppDataSource.transaction(async (manager) => {
      const areaRepository = manager.getRepository(Area);
      const nombre = body.nombre.trim();
      const clave = body.clave.trim().toUpperCase();

      await ensureUniqueArea(areaRepository, { nombre, clave });

      const created = areaRepository.create({
        nombre,
        clave,
        descripcion: body.descripcion?.trim() || "",
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
      });

      const saved = await areaRepository.save(created);
      return findAreaById(areaRepository, saved.id_area);
    });

    return [mapArea(area), null];
  } catch (error) {
    console.error("Error al crear área:", error);
    return [null, error.message || "Error interno al crear el área"];
  }
}

export async function getAreaService(query) {
  try {
    const areaRepository = AppDataSource.getRepository(Area);
    const area = await findAreaById(areaRepository, query.id_area);

    if (!area) return [null, "Área no encontrada."];

    return [mapArea(area), null];
  } catch (error) {
    console.error("Error al obtener área:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getAreasService(query = {}) {
  try {
    const areaRepository = AppDataSource.getRepository(Area);
    const search = normalizeString(query.search);
    const activeFilter = parseOptionalBoolean(query.active ?? query.activo);
    const includeInactive = parseOptionalBoolean(query.includeInactive);

    let areas = await areaRepository.find({
      order: { nombre: "ASC" },
    });

    if (activeFilter !== undefined) {
      areas = areas.filter((item) => Boolean(item.activo) === activeFilter);
    } else if (includeInactive === false) {
      areas = areas.filter((item) => Boolean(item.activo));
    }

    if (search) {
      areas = areas.filter((item) =>
        [item.nombre, item.clave, item.descripcion]
          .filter(Boolean)
          .some((value) => normalizeString(value).includes(search)),
      );
    }

    return [areas.map(mapArea), null];
  } catch (error) {
    console.error("Error al obtener áreas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateAreaService(query, body) {
  try {
    const area = await AppDataSource.transaction(async (manager) => {
      const areaRepository = manager.getRepository(Area);
      const areaFound = await findAreaById(areaRepository, query.id_area);

      if (!areaFound) {
        throw new Error("Área no encontrada.");
      }

      const nextNombre = body.nombre !== undefined ? body.nombre.trim() : areaFound.nombre;
      const nextClave =
        body.clave !== undefined ? body.clave.trim().toUpperCase() : areaFound.clave;

      if (body.nombre !== undefined || body.clave !== undefined) {
        await ensureUniqueArea(areaRepository, {
          nombre: nextNombre,
          clave: nextClave,
          excludingId: areaFound.id_area,
        });
      }

      if (body.nombre !== undefined) areaFound.nombre = nextNombre;
      if (body.clave !== undefined) areaFound.clave = nextClave;
      if (body.descripcion !== undefined) areaFound.descripcion = body.descripcion.trim();
      if (body.activo !== undefined) areaFound.activo = Boolean(body.activo);

      await areaRepository.save(areaFound);
      return findAreaById(areaRepository, areaFound.id_area);
    });

    return [mapArea(area), null];
  } catch (error) {
    console.error("Error al actualizar área:", error);
    return [null, error.message || "Error interno al actualizar el área"];
  }
}

export async function toggleAreaActiveService(query) {
  try {
    const area = await AppDataSource.transaction(async (manager) => {
      const areaRepository = manager.getRepository(Area);
      const areaFound = await findAreaById(areaRepository, query.id_area);

      if (!areaFound) {
        throw new Error("Área no encontrada.");
      }

      areaFound.activo = !Boolean(areaFound.activo);
      await areaRepository.save(areaFound);
      return findAreaById(areaRepository, areaFound.id_area);
    });

    return [mapArea(area), null];
  } catch (error) {
    console.error("Error al cambiar estado del área:", error);
    return [null, error.message || "Error interno al cambiar el estado del área"];
  }
}

export async function getAreaUsageService(query) {
  try {
    const usage = await AppDataSource.transaction(async (manager) => {
      const areaRepository = manager.getRepository(Area);
      const areaFound = await findAreaById(areaRepository, query.id_area);

      if (!areaFound) {
        throw new Error("Área no encontrada.");
      }

      return getAreaUsageCounts(manager, areaFound.id_area);
    });

    return [usage, null];
  } catch (error) {
    console.error("Error al obtener uso del área:", error);
    return [null, error.message || "Error interno al obtener uso del área"];
  }
}

export { mapArea, ensureUniqueArea };

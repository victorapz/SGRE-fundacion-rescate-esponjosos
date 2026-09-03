"use strict";

import { AppDataSource } from "../config/configDb.js";
import Comuna from "../entities/comuna.entity.js";
import Region from "../entities/region.entity.js";
import { normalizeString, parseOptionalBoolean } from "./region.service.js";

function mapComuna(comuna) {
  if (!comuna) return null;

  return {
    id_comuna: comuna.id_comuna,
    nombre: comuna.nombre || "",
    codigo: comuna.codigo || null,
    activo: comuna.activo !== undefined ? Boolean(comuna.activo) : true,
    region: comuna.region
      ? {
          id_region: comuna.region.id_region,
          clave: comuna.region.clave || "",
          codigo: comuna.region.clave || "",
          nombre: comuna.region.nombre || "",
          activo: comuna.region.activo !== undefined ? Boolean(comuna.region.activo) : true,
          orden: Number(comuna.region.orden || 0),
        }
      : null,
    createdAt: comuna.createdAt || null,
    updatedAt: comuna.updatedAt || null,
  };
}

async function findRegionOrThrow(manager, regionId) {
  const regionRepository = manager.getRepository(Region);
  const region = await regionRepository.findOne({
    where: { id_region: Number(regionId) },
  });

  if (!region) {
    throw new Error("La región seleccionada no existe.");
  }

  return region;
}

async function findComunaById(repository, id) {
  return repository.findOne({
    where: { id_comuna: Number(id) },
    relations: {
      region: true,
    },
  });
}

async function ensureUniqueComuna(repository, { nombre, regionId, excludingId = null }) {
  const comunas = await repository.find({
    relations: {
      region: true,
    },
  });
  const normalizedNombre = normalizeString(nombre);

  const duplicate = comunas.find(
    (item) =>
      Number(item.id_comuna) !== Number(excludingId)
      && Number(item.region?.id_region) === Number(regionId)
      && normalizeString(item.nombre) === normalizedNombre,
  );

  if (duplicate) {
    throw new Error("Ya existe una comuna con ese nombre en la región seleccionada.");
  }
}

export async function createComunaService(body) {
  try {
    const comuna = await AppDataSource.transaction(async (manager) => {
      const region = await findRegionOrThrow(manager, body.region_id);

      if (!region.activo && body.activo !== false) {
        throw new Error("No puedes crear una comuna activa dentro de una región inactiva.");
      }

      const comunaRepository = manager.getRepository(Comuna);
      const nombre = body.nombre.trim();
      await ensureUniqueComuna(comunaRepository, {
        nombre,
        regionId: region.id_region,
      });

      const created = comunaRepository.create({
        nombre,
        codigo: body.codigo ? body.codigo.trim().toUpperCase() : null,
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        region: { id_region: Number(region.id_region) },
      });

      const saved = await comunaRepository.save(created);
      return findComunaById(comunaRepository, saved.id_comuna);
    });

    return [mapComuna(comuna), null];
  } catch (error) {
    console.error("Error al crear comuna:", error);
    return [null, error.message || "Error interno al crear comuna"];
  }
}

export async function getComunaService(query) {
  try {
    const comunaRepository = AppDataSource.getRepository(Comuna);
    const comuna = await findComunaById(comunaRepository, query.id_comuna);

    if (!comuna) return [null, "Comuna no encontrada."];

    return [mapComuna(comuna), null];
  } catch (error) {
    console.error("Error al obtener comuna:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getComunasService(query = {}) {
  try {
    const comunaRepository = AppDataSource.getRepository(Comuna);
    const search = normalizeString(query.search);
    const activeFilter = parseOptionalBoolean(query.active ?? query.activo);
    const includeInactive = parseOptionalBoolean(query.includeInactive);
    let comunas = await comunaRepository.find({
      relations: {
        region: true,
      },
      order: {
        nombre: "ASC",
      },
    });

    if (query.region_id) {
      comunas = comunas.filter(
        (item) => Number(item.region?.id_region) === Number(query.region_id),
      );
    }

    if (activeFilter !== undefined) {
      comunas = comunas.filter((item) => Boolean(item.activo) === activeFilter);
    } else if (includeInactive === false) {
      comunas = comunas.filter((item) => Boolean(item.activo));
    }

    if (search) {
      comunas = comunas.filter((item) =>
        [item.nombre, item.codigo, item.region?.nombre, item.region?.clave]
          .filter(Boolean)
          .some((value) => normalizeString(value).includes(search)),
      );
    }

    return [comunas.map(mapComuna), null];
  } catch (error) {
    console.error("Error al obtener comunas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateComunaService(query, body) {
  try {
    const comuna = await AppDataSource.transaction(async (manager) => {
      const comunaRepository = manager.getRepository(Comuna);
      const comunaFound = await findComunaById(comunaRepository, query.id_comuna);

      if (!comunaFound) {
        throw new Error("Comuna no encontrada.");
      }

      const nextRegionId =
        body.region_id !== undefined
          ? Number(body.region_id)
          : Number(comunaFound.region?.id_region);
      const region = await findRegionOrThrow(manager, nextRegionId);

      if (!region.activo && (body.activo === undefined ? comunaFound.activo : body.activo)) {
        throw new Error("No puedes dejar una comuna activa dentro de una región inactiva.");
      }

      const nextNombre = body.nombre !== undefined ? body.nombre.trim() : comunaFound.nombre;
      if (body.nombre !== undefined || body.region_id !== undefined) {
        await ensureUniqueComuna(comunaRepository, {
          nombre: nextNombre,
          regionId: nextRegionId,
          excludingId: comunaFound.id_comuna,
        });
      }

      if (body.nombre !== undefined) comunaFound.nombre = nextNombre;
      if (body.codigo !== undefined) {
        comunaFound.codigo = body.codigo ? body.codigo.trim().toUpperCase() : null;
      }
      if (body.activo !== undefined) comunaFound.activo = Boolean(body.activo);
      if (body.region_id !== undefined) {
        comunaFound.region = { id_region: nextRegionId };
      }

      await comunaRepository.save(comunaFound);
      return findComunaById(comunaRepository, comunaFound.id_comuna);
    });

    return [mapComuna(comuna), null];
  } catch (error) {
    console.error("Error al actualizar comuna:", error);
    return [null, error.message || "Error interno al actualizar la comuna"];
  }
}

export async function toggleComunaActiveService(query) {
  try {
    const comuna = await AppDataSource.transaction(async (manager) => {
      const comunaRepository = manager.getRepository(Comuna);
      const comunaFound = await findComunaById(comunaRepository, query.id_comuna);

      if (!comunaFound) {
        throw new Error("Comuna no encontrada.");
      }

      if (!comunaFound.activo) {
        const region = await findRegionOrThrow(manager, comunaFound.region?.id_region);
        if (!region.activo) {
          throw new Error(
            "No puedes activar una comuna mientras su región permanezca inactiva.",
          );
        }
      }

      comunaFound.activo = !Boolean(comunaFound.activo);
      await comunaRepository.save(comunaFound);
      return findComunaById(comunaRepository, comunaFound.id_comuna);
    });

    return [mapComuna(comuna), null];
  } catch (error) {
    console.error("Error al cambiar estado de la comuna:", error);
    return [null, error.message || "Error interno al cambiar el estado de la comuna"];
  }
}

export { mapComuna };

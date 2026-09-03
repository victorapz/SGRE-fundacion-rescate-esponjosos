"use strict";

import { AppDataSource } from "../../config/configDb.js";
import FosterHome from "../../entities/foster_home.entity.js";
import FosterHomeAllowedAnimal from "../../entities/foster_home_allowed_animals.js";
import {
  normalizeNullableString,
  serializeAllowedAnimal,
} from "./foster_shared.service.js";

async function getAllowedAnimalWithHome(id) {
  const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);

  return allowedAnimalRepository.findOne({
    where: { id_allowed_animal: Number(id) },
    relations: {
      foster_home: true,
    },
  });
}

async function findActiveDuplicateRule({
  fosterHomeId,
  especie,
  estadoPermitido,
  excludedId = null,
}) {
  const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);
  const rules = await allowedAnimalRepository.find({
    where: {
      foster_home: { id_hogar_temporal: Number(fosterHomeId) },
      activo: true,
    },
    relations: {
      foster_home: true,
    },
  });

  return rules.find((rule) => {
    if (excludedId !== null && Number(rule.id_allowed_animal) === Number(excludedId)) {
      return false;
    }

    return rule.especie === especie && rule.estado_permitido === estadoPermitido;
  });
}

async function ensureFosterHomeExists(fosterHomeId) {
  const fosterHomeRepository = AppDataSource.getRepository(FosterHome);
  return fosterHomeRepository.findOne({
    where: { id_hogar_temporal: Number(fosterHomeId) },
  });
}

export async function createFosterHomeAllowedAnimalService(body) {
  try {
    const fosterHome = await ensureFosterHomeExists(body.foster_home_id);
    if (!fosterHome) return [null, "El hogar temporal indicado no existe."];

    if (body.activo !== false) {
      const duplicateRule = await findActiveDuplicateRule({
        fosterHomeId: body.foster_home_id,
        especie: body.especie,
        estadoPermitido: body.estado_permitido,
      });

      if (duplicateRule) {
        return [null, "Ya existe una regla activa con la misma especie y estado permitido."];
      }
    }

    const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);
    const allowedAnimal = allowedAnimalRepository.create({
      especie: body.especie,
      estado_permitido: body.estado_permitido,
      capacidad_maxima: body.capacidad_maxima ?? null,
      observaciones: normalizeNullableString(body.observaciones),
      activo: body.activo !== undefined ? Boolean(body.activo) : true,
      foster_home: { id_hogar_temporal: Number(body.foster_home_id) },
    });

    const savedAllowedAnimal = await allowedAnimalRepository.save(allowedAnimal);
    const createdAllowedAnimal = await getAllowedAnimalWithHome(
      savedAllowedAnimal.id_allowed_animal,
    );

    return [serializeAllowedAnimal(createdAllowedAnimal), null];
  } catch (error) {
    console.error("Error al crear regla de animal permitido:", error);
    return [null, "Error interno al crear la regla de animal permitido"];
  }
}

export async function getFosterHomeAllowedAnimalService(query) {
  try {
    const allowedAnimal = await getAllowedAnimalWithHome(query.id);
    if (!allowedAnimal) return [null, "Regla de animal permitido no encontrada"];

    return [serializeAllowedAnimal(allowedAnimal), null];
  } catch (error) {
    console.error("Error al obtener regla de animal permitido:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getFosterHomeAllowedAnimalsService(query) {
  try {
    const fosterHome = await ensureFosterHomeExists(query.foster_home_id);
    if (!fosterHome) return [null, "El hogar temporal indicado no existe."];

    const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);
    const allowedAnimals = await allowedAnimalRepository.find({
      where: {
        foster_home: { id_hogar_temporal: Number(query.foster_home_id) },
      },
      relations: {
        foster_home: true,
      },
    });

    if (!allowedAnimals || allowedAnimals.length === 0) {
      return [null, "No hay reglas de animales permitidos"];
    }

    return [allowedAnimals.map(serializeAllowedAnimal), null];
  } catch (error) {
    console.error("Error al listar reglas de animales permitidos:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateFosterHomeAllowedAnimalService(query, body) {
  try {
    const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);
    const allowedAnimal = await allowedAnimalRepository.findOne({
      where: { id_allowed_animal: Number(query.id) },
      relations: {
        foster_home: true,
      },
    });

    if (!allowedAnimal) return [null, "Regla de animal permitido no encontrada"];

    const nextEspecie = body.especie ?? allowedAnimal.especie;
    const nextEstadoPermitido = body.estado_permitido ?? allowedAnimal.estado_permitido;
    const nextActivo = body.activo !== undefined ? Boolean(body.activo) : Boolean(allowedAnimal.activo);

    if (nextActivo) {
      const duplicateRule = await findActiveDuplicateRule({
        fosterHomeId: allowedAnimal.foster_home?.id_hogar_temporal,
        especie: nextEspecie,
        estadoPermitido: nextEstadoPermitido,
        excludedId: allowedAnimal.id_allowed_animal,
      });

      if (duplicateRule) {
        return [null, "Ya existe una regla activa con la misma especie y estado permitido."];
      }
    }

    if (body.especie !== undefined) {
      allowedAnimal.especie = body.especie;
    }
    if (body.estado_permitido !== undefined) {
      allowedAnimal.estado_permitido = body.estado_permitido;
    }
    if (body.capacidad_maxima !== undefined) {
      allowedAnimal.capacidad_maxima = body.capacidad_maxima ?? null;
    }
    if (body.observaciones !== undefined) {
      allowedAnimal.observaciones = normalizeNullableString(body.observaciones);
    }
    if (body.activo !== undefined) {
      allowedAnimal.activo = Boolean(body.activo);
    }

    await allowedAnimalRepository.save(allowedAnimal);

    const updatedAllowedAnimal = await getAllowedAnimalWithHome(allowedAnimal.id_allowed_animal);
    return [serializeAllowedAnimal(updatedAllowedAnimal), null];
  } catch (error) {
    console.error("Error al actualizar regla de animal permitido:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteFosterHomeAllowedAnimalService(query) {
  try {
    const allowedAnimalRepository = AppDataSource.getRepository(FosterHomeAllowedAnimal);
    const allowedAnimal = await allowedAnimalRepository.findOne({
      where: { id_allowed_animal: Number(query.id) },
    });

    if (!allowedAnimal) return [null, "Regla de animal permitido no encontrada"];

    const deletedAllowedAnimal = await allowedAnimalRepository.remove(allowedAnimal);
    return [deletedAllowedAnimal, null];
  } catch (error) {
    console.error("Error al eliminar regla de animal permitido:", error);
    return [null, "Error interno del servidor"];
  }
}

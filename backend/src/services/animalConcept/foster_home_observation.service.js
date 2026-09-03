"use strict";

import { AppDataSource } from "../../config/configDb.js";
import FosterHome from "../../entities/foster_home.entity.js";
import FosterHomeObservation from "../../entities/foster_home_observation.entity.js";

function serializeObservation(observation) {
  if (!observation) return null;

  return {
    id_foster_home_observation: observation.id_foster_home_observation,
    texto: observation.texto || "",
    foster_home_id: observation.foster_home?.id_hogar_temporal || null,
    createdAt: observation.createdAt || null,
    updatedAt: observation.updatedAt || null,
  };
}

async function ensureFosterHomeExists(fosterHomeId) {
  const fosterHomeRepository = AppDataSource.getRepository(FosterHome);
  return fosterHomeRepository.findOne({
    where: { id_hogar_temporal: Number(fosterHomeId) },
  });
}

async function getObservationById(id) {
  const observationRepository = AppDataSource.getRepository(FosterHomeObservation);
  return observationRepository.findOne({
    where: { id_foster_home_observation: Number(id) },
    relations: {
      foster_home: true,
    },
  });
}

export async function createFosterHomeObservationService(body) {
  try {
    const fosterHome = await ensureFosterHomeExists(body.foster_home_id);
    if (!fosterHome) return [null, "El hogar temporal indicado no existe."];

    const observationRepository = AppDataSource.getRepository(FosterHomeObservation);
    const observation = observationRepository.create({
      texto: body.texto.trim(),
      foster_home: { id_hogar_temporal: Number(body.foster_home_id) },
    });

    const savedObservation = await observationRepository.save(observation);
    const createdObservation = await getObservationById(savedObservation.id_foster_home_observation);

    return [serializeObservation(createdObservation), null];
  } catch (error) {
    console.error("Error al crear observacion del hogar temporal:", error);
    return [null, "Error interno al crear la observacion del hogar temporal"];
  }
}

export async function getFosterHomeObservationsService(query) {
  try {
    const fosterHome = await ensureFosterHomeExists(query.foster_home_id);
    if (!fosterHome) return [null, "El hogar temporal indicado no existe."];

    const observationRepository = AppDataSource.getRepository(FosterHomeObservation);
    const observations = await observationRepository.find({
      where: {
        foster_home: { id_hogar_temporal: Number(query.foster_home_id) },
      },
      relations: {
        foster_home: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (!observations || observations.length === 0) {
      return [null, "No hay observaciones del hogar temporal"];
    }

    return [observations.map(serializeObservation), null];
  } catch (error) {
    console.error("Error al listar observaciones del hogar temporal:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteFosterHomeObservationService(query) {
  try {
    const observationRepository = AppDataSource.getRepository(FosterHomeObservation);
    const observation = await observationRepository.findOne({
      where: { id_foster_home_observation: Number(query.id) },
    });

    if (!observation) return [null, "Observacion del hogar temporal no encontrada"];

    const deletedObservation = await observationRepository.remove(observation);
    return [deletedObservation, null];
  } catch (error) {
    console.error("Error al eliminar observacion del hogar temporal:", error);
    return [null, "Error interno del servidor"];
  }
}

export { serializeObservation };

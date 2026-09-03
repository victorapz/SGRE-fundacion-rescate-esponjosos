"use strict";

import FosterAssignment from "../../entities/foster_assignment.entity.js";
import { AppDataSource } from "../../config/configDb.js";
import { locationRelations } from "../location.shared.js";
import { serializeFosterAssignment } from "./foster_shared.service.js";

function buildAssignmentWhere(query = {}) {
  const where = {};

  if (query.hogar_temporal_id !== undefined) {
    where.foster_home = {
      id_hogar_temporal: Number(query.hogar_temporal_id),
    };
  }

  if (query.estado !== undefined) {
    where.estado = query.estado;
  }

  return where;
}

async function getFosterAssignmentWithRelations(repository, assignmentId) {
  return repository.findOne({
    where: { id_foster_assignment: Number(assignmentId) },
    relations: {
      animal: true,
      foster_home: {
        responsable_usuario: {
          location: locationRelations,
        },
        miembros: {
          user: {
            location: locationRelations,
          },
        },
      },
    },
  });
}

export async function createFosterAssignmentService(body) {
  try {
    const {
      animal_id,
      hogar_temporal_id,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_termino,
      observaciones,
    } = body;

    const fosterAssignmentRepository = AppDataSource.getRepository(FosterAssignment);

    const nuevaAsignacion = fosterAssignmentRepository.create({
      animal_id,
      hogar_temporal_id,
      fecha_inicio,
      fecha_fin,
      estado,
      motivo_termino,
      observaciones,
      animal: { id_animal: Number(animal_id) },
      foster_home: { id_hogar_temporal: Number(hogar_temporal_id) },
    });

    const asignacionGuardada = await fosterAssignmentRepository.save(nuevaAsignacion);
    const assignmentWithRelations = await getFosterAssignmentWithRelations(
      fosterAssignmentRepository,
      asignacionGuardada.id_foster_assignment,
    );

    return [serializeFosterAssignment(assignmentWithRelations), null];
  } catch (error) {
    console.error("Error al crear asignacion:", error);
    return [null, "Error interno al crear asignacion"];
  }
}

export async function getFosterAssignmentService(query) {
  try {
    const { id } = query;
    const fosterAssignmentRepository = AppDataSource.getRepository(FosterAssignment);

    const assignmentFound = await getFosterAssignmentWithRelations(
      fosterAssignmentRepository,
      id,
    );

    if (!assignmentFound) return [null, "Asignacion no encontrada"];

    return [serializeFosterAssignment(assignmentFound), null];
  } catch (error) {
    console.error("Error al obtener la asignacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getFosterAssignmentsService(query = {}) {
  try {
    const fosterAssignmentRepository = AppDataSource.getRepository(FosterAssignment);
    const assignments = await fosterAssignmentRepository.find({
      where: buildAssignmentWhere(query),
      relations: {
        animal: true,
        foster_home: {
          responsable_usuario: {
            location: locationRelations,
          },
          miembros: {
            user: {
              location: locationRelations,
            },
          },
        },
      },
      order: {
        fecha_inicio: "DESC",
      },
    });

    return [assignments.map(serializeFosterAssignment), null];
  } catch (error) {
    console.error("Error al obtener asignaciones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateFosterAssignmentService(query, body) {
  try {
    const { id } = query;

    const fosterAssignmentRepository = AppDataSource.getRepository(FosterAssignment);

    const assignmentFound = await fosterAssignmentRepository.findOne({
      where: { id_foster_assignment: Number(id) },
      relations: {
        animal: true,
        foster_home: {
          responsable_usuario: {
            location: locationRelations,
          },
          miembros: {
            user: {
              location: locationRelations,
            },
          },
        },
      },
    });

    if (!assignmentFound) return [null, "Asignacion no encontrada"];

    if (body.animal_id !== undefined) assignmentFound.animal_id = body.animal_id;
    if (body.hogar_temporal_id !== undefined) {
      assignmentFound.hogar_temporal_id = body.hogar_temporal_id;
    }
    if (body.fecha_inicio) assignmentFound.fecha_inicio = body.fecha_inicio;
    if (body.fecha_fin !== undefined) assignmentFound.fecha_fin = body.fecha_fin;
    if (body.estado) assignmentFound.estado = body.estado;
    if (body.motivo_termino !== undefined) {
      assignmentFound.motivo_termino = body.motivo_termino;
    }
    if (body.observaciones !== undefined) {
      assignmentFound.observaciones = body.observaciones;
    }

    if (body.animal_id) {
      assignmentFound.animal = { id_animal: Number(body.animal_id) };
    }

    if (body.hogar_temporal_id) {
      assignmentFound.foster_home = {
        id_hogar_temporal: Number(body.hogar_temporal_id),
      };
    }

    await fosterAssignmentRepository.save(assignmentFound);

    const updatedAssignment = await getFosterAssignmentWithRelations(
      fosterAssignmentRepository,
      assignmentFound.id_foster_assignment,
    );

    return [serializeFosterAssignment(updatedAssignment), null];
  } catch (error) {
    console.error("Error al modificar la asignacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteFosterAssignmentService(query) {
  try {
    const { id } = query;

    const fosterAssignmentRepository = AppDataSource.getRepository(FosterAssignment);

    const assignmentFound = await fosterAssignmentRepository.findOne({
      where: { id_foster_assignment: Number(id) },
    });

    if (!assignmentFound) return [null, "Asignacion no encontrada"];

    const assignmentDeleted = await fosterAssignmentRepository.remove(assignmentFound);

    return [assignmentDeleted, null];
  } catch (error) {
    console.error("Error al eliminar la asignacion:", error);
    return [null, "Error interno del servidor"];
  }
}

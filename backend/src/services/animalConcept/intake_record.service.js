"use strict";

import IntakeRecord from "../../entities/animalConcept/intake_record.entity.js";
import { AppDataSource } from "../../config/configDb.js";

function normalizeNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedValue = String(value).trim();
  return normalizedValue === "" ? null : normalizedValue;
}

function serializeIntakeRecord(record) {
  if (!record) return null;

  return {
    ...record,
    fecha_entrega: record.fecha_entrega || null,
    estado_reproduccion_inicial: record.estado_reproduccion_inicial || null,
    edad_estimada: record.edad_estimada || null,
    lugar_entrega: record.lugar_entrega || null,
    causa_entrega: record.causa_entrega || null,
    condiciones_iniciales: record.condiciones_iniciales || null,
    nombre_quien_entrega: record.nombre_quien_entrega || null,
  };
}

export async function createIntakeRecordService(body) {
  try {
    const {
      fecha_entrega,
      estado_reproduccion_inicial,
      edad_estimada,
      lugar_entrega,
      causa_entrega,
      condiciones_iniciales,
      nombre_quien_entrega,
      animal_id,
      quien_recibe_id,
    } = body;

    const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);

    const nuevoRegistro = intakeRecordRepository.create({
      fecha_entrega: normalizeNullableString(fecha_entrega),
      estado_reproduccion_inicial: normalizeNullableString(
        estado_reproduccion_inicial,
      ),
      edad_estimada: normalizeNullableString(edad_estimada),
      lugar_entrega: normalizeNullableString(lugar_entrega),
      causa_entrega: normalizeNullableString(causa_entrega),
      condiciones_iniciales: normalizeNullableString(condiciones_iniciales),
      nombre_quien_entrega: normalizeNullableString(nombre_quien_entrega),
      animal: { id_animal: Number(animal_id) },
      quien_recibe: quien_recibe_id
        ? { id_usuario: Number(quien_recibe_id) }
        : null,
    });

    const registroGuardado = await intakeRecordRepository.save(nuevoRegistro);

    const createdRecord = await intakeRecordRepository.findOne({
      where: { id_intake_record: registroGuardado.id_intake_record },
      relations: {
        animal: true,
        quien_recibe: true,
      },
    });

    return [serializeIntakeRecord(createdRecord), null];
  } catch (error) {
    console.error("Error al crear registro:", error);
    return [null, "Error interno al crear registro"];
  }
}

export async function getIntakeRecordService(query) {
  try {
    const { id } = query;
    const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);

    const recordFound = await intakeRecordRepository.findOne({
      where: { id_intake_record: id },
      relations: {
        animal: true,
        quien_recibe: true,
      },
    });

    if (!recordFound) return [null, "Registro no encontrado"];

    return [serializeIntakeRecord(recordFound), null];
  } catch (error) {
    console.error("Error al obtener el registro:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getIntakeRecordsService() {
  try {
    const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);
    const records = await intakeRecordRepository.find({
      relations: {
        animal: true,
        quien_recibe: true,
      },
    });

    if (!records || records.length === 0) return [null, "No hay registros"];

    return [records.map(serializeIntakeRecord), null];
  } catch (error) {
    console.error("Error al obtener registros:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateIntakeRecordService(query, body) {
  try {
    const { id } = query;
    const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);

    const recordFound = await intakeRecordRepository.findOne({
      where: { id_intake_record: id },
      relations: {
        animal: true,
        quien_recibe: true,
      },
    });

    if (!recordFound) return [null, "Registro no encontrado"];

    if (body.fecha_entrega !== undefined) {
      recordFound.fecha_entrega = normalizeNullableString(body.fecha_entrega);
    }
    if (body.estado_reproduccion_inicial !== undefined) {
      recordFound.estado_reproduccion_inicial = normalizeNullableString(
        body.estado_reproduccion_inicial,
      );
    }
    if (body.edad_estimada !== undefined) {
      recordFound.edad_estimada = normalizeNullableString(body.edad_estimada);
    }
    if (body.lugar_entrega !== undefined) {
      recordFound.lugar_entrega = normalizeNullableString(body.lugar_entrega);
    }
    if (body.causa_entrega !== undefined) {
      recordFound.causa_entrega = normalizeNullableString(body.causa_entrega);
    }
    if (body.condiciones_iniciales !== undefined) {
      recordFound.condiciones_iniciales = normalizeNullableString(
        body.condiciones_iniciales,
      );
    }
    if (body.nombre_quien_entrega !== undefined) {
      recordFound.nombre_quien_entrega = normalizeNullableString(
        body.nombre_quien_entrega,
      );
    }

    if (body.animal_id !== undefined) {
      recordFound.animal = { id_animal: Number(body.animal_id) };
    }

    if (body.quien_recibe_id !== undefined) {
      recordFound.quien_recibe = body.quien_recibe_id
        ? { id_usuario: Number(body.quien_recibe_id) }
        : null;
    }

    await intakeRecordRepository.save(recordFound);

    const updatedRecord = await intakeRecordRepository.findOne({
      where: { id_intake_record: recordFound.id_intake_record },
      relations: {
        animal: true,
        quien_recibe: true,
      },
    });

    return [serializeIntakeRecord(updatedRecord), null];
  } catch (error) {
    console.error("Error al modificar el registro:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteIntakeRecordService(query) {
  try {
    const { id } = query;

    const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);

    const recordFound = await intakeRecordRepository.findOne({
      where: { id_intake_record: id },
    });

    if (!recordFound) return [null, "Registro no encontrado"];

    const recordDeleted = await intakeRecordRepository.remove(recordFound);

    return [recordDeleted, null];
  } catch (error) {
    console.error("Error al eliminar el registro:", error);
    return [null, "Error interno del servidor"];
  }
}

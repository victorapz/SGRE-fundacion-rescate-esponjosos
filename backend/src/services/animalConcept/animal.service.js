"use strict";

import Animal, {
  TipoFechaNacimiento,
} from "../../entities/animalConcept/animal.entity.js";
import AnimalDiets from "../../entities/animalConcept/animal_diets.entity.js";
import AnimalProfile from "../../entities/animalConcept/animal_profile.entity.js";
import Exam from "../../entities/animalConcept/exam.entity.js";
import Hospitalization from "../../entities/animalConcept/hospitalization.entity.js";
import IntakeRecord from "../../entities/animalConcept/intake_record.entity.js";
import Procedure from "../../entities/animalConcept/procedure.entity.js";
import Region from "../../entities/region.entity.js";
import FosterAssignment from "../../entities/foster_assignment.entity.js";
import Sponsorship from "../../entities/financialConcept/sponsorship.entity.js";
import FileAsset, {
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
} from "../../entities/file_asset.entity.js";
import VetCheckup from "../../entities/animalConcept/vet_checkup.entity.js";
import { AppDataSource } from "../../config/configDb.js";

const REGION_NOT_AVAILABLE_MESSAGE =
  "La región seleccionada no existe o ya no está disponible.";
const ANIMAL_DELETE_BLOCKED_MESSAGE =
  "No se puede eliminar el animal porque posee historial o registros asociados.";
const ANIMAL_DELETE_BLOCKED_DETAIL_MESSAGE =
  "Posee ficha de ingreso, registros clínicos o archivos asociados.";

function normalizeNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedValue = String(value).trim();
  return normalizedValue === "" ? null : normalizedValue;
}

function normalizeNullableDate(value) {
  return normalizeNullableString(value);
}

function isRegionForeignKeyError(error) {
  const normalizedConstraint = String(
    error?.constraint
    || error?.driverError?.constraint
    || "",
  ).toLowerCase();

  return (
    error?.code === "23503"
    && (
      normalizedConstraint.includes("region")
      || String(error?.detail || error?.driverError?.detail || "").includes("region_id")
    )
  );
}

async function resolveRegionOrThrow(regionId, regionRepository) {
  const normalizedRegionId = Number(regionId);

  if (!Number.isInteger(normalizedRegionId) || normalizedRegionId <= 0) {
    throw new Error(REGION_NOT_AVAILABLE_MESSAGE);
  }

  const region = await regionRepository.findOne({
    where: { id_region: normalizedRegionId },
  });

  if (!region) {
    throw new Error(REGION_NOT_AVAILABLE_MESSAGE);
  }

  return region;
}

async function getAnimalDependencySummary(animalId) {
  const normalizedAnimalId = Number(animalId);

  const [
    profileCount,
    intakeCount,
    dietCount,
    examCount,
    hospitalizationCount,
    procedureCount,
    checkupCount,
    fosterAssignmentCount,
    sponsorshipCount,
    fileCount,
  ] = await Promise.all([
    AppDataSource.getRepository(AnimalProfile).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(IntakeRecord).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(AnimalDiets).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(Exam).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(Hospitalization).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(Procedure).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(VetCheckup).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(FosterAssignment).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(Sponsorship).count({
      where: { animal: { id_animal: normalizedAnimalId } },
    }),
    AppDataSource.getRepository(FileAsset).count({
      where: {
        entity_type: FILE_ASSET_ENTITY_TYPES.ANIMAL,
        entity_id: normalizedAnimalId,
        status: FILE_ASSET_STATUS.ACTIVO,
      },
    }),
  ]);

  return {
    profileCount,
    intakeCount,
    dietCount,
    examCount,
    hospitalizationCount,
    procedureCount,
    checkupCount,
    fosterAssignmentCount,
    sponsorshipCount,
    fileCount,
  };
}

function animalHasDependencies(summary = {}) {
  return Object.values(summary).some((count) => Number(count) > 0);
}

function getCurrentIntakeRecord(animal = {}) {
  if (!Array.isArray(animal.intakeRecords) || animal.intakeRecords.length === 0) {
    return null;
  }

  return [...animal.intakeRecords].sort(
    (recordA, recordB) =>
      Number(recordA?.id_intake_record || 0) - Number(recordB?.id_intake_record || 0),
  )[animal.intakeRecords.length - 1];
}

function serializeAnimal(animal) {
  if (!animal) return null;

  const currentIntakeRecord = getCurrentIntakeRecord(animal);

  return {
    ...animal,
    fecha_nacimiento: animal.fecha_nacimiento || null,
    tipo_fecha_nacimiento:
      animal.tipo_fecha_nacimiento ||
      (animal.fecha_nacimiento
        ? TipoFechaNacimiento.ESTIMADA
        : TipoFechaNacimiento.DESCONOCIDA),
    fallecido: Boolean(animal.fallecido),
    fecha_fallecimiento: animal.fecha_fallecimiento || null,
    fecha_llegada_fundacion: currentIntakeRecord?.fecha_entrega || null,
    proximo_control: animal.proximo_control || null,
  };
}

function normalizeUpcomingDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return null;
  }

  return String(value);
}

async function getAnimalNextControlDate(animalId) {
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const [hospitalizations, checkups] = await Promise.all([
    AppDataSource.getRepository(Hospitalization).find({
      where: { animal: { id_animal: Number(animalId) } },
      select: {
        fecha_control_post_alta: true,
      },
    }),
    AppDataSource.getRepository(VetCheckup).find({
      where: { animal: { id_animal: Number(animalId) } },
      select: {
        fecha_proximo_control: true,
      },
    }),
  ]);

  const candidateDates = [
    ...hospitalizations.map((item) => normalizeUpcomingDate(item.fecha_control_post_alta)),
    ...checkups.map((item) => normalizeUpcomingDate(item.fecha_proximo_control)),
  ]
    .filter(Boolean)
    .filter((value) => value >= today)
    .sort();

  return candidateDates[0] || null;
}

async function syncAnimalIntakeRecord(animalId, fechaLlegadaFundacion) {
  if (fechaLlegadaFundacion === undefined) return;

  const intakeRecordRepository = AppDataSource.getRepository(IntakeRecord);
  const currentRecord = await intakeRecordRepository.findOne({
    where: { animal: { id_animal: Number(animalId) } },
    relations: {
      animal: true,
      quien_recibe: true,
    },
  });

  if (!fechaLlegadaFundacion) {
    if (!currentRecord) return;

    currentRecord.fecha_entrega = null;
    await intakeRecordRepository.save(currentRecord);
    return;
  }

  if (currentRecord) {
    currentRecord.fecha_entrega = fechaLlegadaFundacion;
    await intakeRecordRepository.save(currentRecord);
    return;
  }

  const newRecord = intakeRecordRepository.create({
    fecha_entrega: fechaLlegadaFundacion,
    animal: { id_animal: Number(animalId) },
  });

  await intakeRecordRepository.save(newRecord);
}

export async function createAnimalService(body) {
  try {
    const {
      nombre,
      sexo,
      especie,
      fecha_nacimiento,
      tipo_fecha_nacimiento,
      estado_salud_actual,
      estado_adopcion,
      fecha_llegada_fundacion,
      fallecido,
      fecha_fallecimiento,
      region_id,
    } = body;

    const animalRepository = AppDataSource.getRepository(Animal);
    const regionRepository = AppDataSource.getRepository(Region);
    const region = await resolveRegionOrThrow(region_id, regionRepository);

    const nuevoAnimal = animalRepository.create({
      nombre,
      sexo,
      especie,
      fecha_nacimiento: normalizeNullableDate(fecha_nacimiento),
      tipo_fecha_nacimiento:
        tipo_fecha_nacimiento || TipoFechaNacimiento.DESCONOCIDA,
      estado_salud_actual,
      estado_adopcion: estado_adopcion ?? null,
      fallecido: Boolean(fallecido),
      fecha_fallecimiento: Boolean(fallecido)
        ? normalizeNullableDate(fecha_fallecimiento)
        : null,
      region: { id_region: Number(region.id_region) },
    });

    const animalGuardado = await animalRepository.save(nuevoAnimal);

    await syncAnimalIntakeRecord(
      animalGuardado.id_animal,
      normalizeNullableDate(fecha_llegada_fundacion),
    );

    const createdAnimal = await animalRepository.findOne({
      where: { id_animal: animalGuardado.id_animal },
      relations: {
        region: true,
        intakeRecords: true,
      },
    });

    return [serializeAnimal(createdAnimal), null];
  } catch (error) {
    console.error("Error al crear animal:", error);
    if (error?.message === REGION_NOT_AVAILABLE_MESSAGE || isRegionForeignKeyError(error)) {
      return [null, REGION_NOT_AVAILABLE_MESSAGE];
    }
    return [null, "Error interno al crear animal"];
  }
}

export async function getAnimalService(query) {
  try {
    const { id } = query;
    const animalRepository = AppDataSource.getRepository(Animal);

    const animalFound = await animalRepository.findOne({
      where: { id_animal: id },
      relations: {
        region: true,
        intakeRecords: true,
      },
    });

    if (!animalFound) return [null, "Animal no encontrado"];

    const nextControlDate = await getAnimalNextControlDate(animalFound.id_animal);

    return [serializeAnimal({ ...animalFound, proximo_control: nextControlDate }), null];
  } catch (error) {
    console.error("Error al obtener el animal:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getAnimalsService() {
  try {
    const animalRepository = AppDataSource.getRepository(Animal);
    const animals = await animalRepository.find({
      relations: {
        region: true,
        intakeRecords: true,
      },
    });

    if (!animals || animals.length === 0) return [null, "No hay animales"];

    return [animals.map(serializeAnimal), null];
  } catch (error) {
    console.error("Error al obtener animales:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateAnimalService(query, body) {
  try {
    const { id } = query;

    const animalRepository = AppDataSource.getRepository(Animal);
    const regionRepository = AppDataSource.getRepository(Region);

    const animalFound = await animalRepository.findOne({
      where: { id_animal: id },
      relations: {
        region: true,
        intakeRecords: true,
      },
    });

    if (!animalFound) return [null, "Animal no encontrado"];

    if (body.nombre !== undefined) animalFound.nombre = body.nombre;
    if (body.sexo !== undefined) animalFound.sexo = body.sexo;
    if (body.especie !== undefined) animalFound.especie = body.especie;
    if (body.fecha_nacimiento !== undefined) {
      animalFound.fecha_nacimiento = normalizeNullableDate(body.fecha_nacimiento);
    }
    if (body.tipo_fecha_nacimiento !== undefined) {
      animalFound.tipo_fecha_nacimiento =
        body.tipo_fecha_nacimiento || TipoFechaNacimiento.DESCONOCIDA;
    }

    if (body.estado_salud_actual !== undefined) {
      animalFound.estado_salud_actual = body.estado_salud_actual;
    }
    if (body.estado_adopcion !== undefined) {
      animalFound.estado_adopcion = body.estado_adopcion;
    }
    if (body.fallecido !== undefined) {
      animalFound.fallecido = Boolean(body.fallecido);
      if (!animalFound.fallecido && body.fecha_fallecimiento === undefined) {
        animalFound.fecha_fallecimiento = null;
      }
    }
    if (body.fecha_fallecimiento !== undefined) {
      animalFound.fecha_fallecimiento = animalFound.fallecido
        ? normalizeNullableDate(body.fecha_fallecimiento)
        : null;
    }

    if (body.region_id !== undefined) {
      const region = await resolveRegionOrThrow(body.region_id, regionRepository);
      animalFound.region = { id_region: Number(region.id_region) };
    }

    await animalRepository.save(animalFound);

    await syncAnimalIntakeRecord(
      animalFound.id_animal,
      normalizeNullableDate(body.fecha_llegada_fundacion),
    );

    const updatedAnimal = await animalRepository.findOne({
      where: { id_animal: animalFound.id_animal },
      relations: {
        region: true,
        intakeRecords: true,
      },
    });

    return [serializeAnimal(updatedAnimal), null];
  } catch (error) {
    console.error("Error al modificar el animal:", error);
    if (error?.message === REGION_NOT_AVAILABLE_MESSAGE || isRegionForeignKeyError(error)) {
      return [null, REGION_NOT_AVAILABLE_MESSAGE];
    }
    return [null, "Error interno del servidor"];
  }
}

export async function deleteAnimalService(query) {
  try {
    const { id } = query;

    const animalRepository = AppDataSource.getRepository(Animal);

    const animalFound = await animalRepository.findOne({
      where: { id_animal: id },
    });

    if (!animalFound) return [null, "Animal no encontrado"];

    const dependencySummary = await getAnimalDependencySummary(id);

    if (animalHasDependencies(dependencySummary)) {
      return [
        null,
        `${ANIMAL_DELETE_BLOCKED_MESSAGE} ${ANIMAL_DELETE_BLOCKED_DETAIL_MESSAGE}`,
      ];
    }

    const animalDeleted = await animalRepository.remove(animalFound);

    return [animalDeleted, null];
  } catch (error) {
    console.error("Error al eliminar el animal:", error);
    return [null, "Error interno del servidor"];
  }
}

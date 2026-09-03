"use strict";

import Veterinarian from "../../entities/animalConcept/veterinarian.entity.js";
import VeterinarianClinic from "../../entities/animalConcept/veterinarian_clinic.entity.js";
import VetClinic from "../../entities/animalConcept/vet_clinic.entity.js";
import { AppDataSource } from "../../config/configDb.js";
import { locationRelations, mapLocationSummary } from "../location.shared.js";

function parseBooleanFilter(value) {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

function getNormalizedVeterinarianClinicIds(veterinarian = {}) {
  const relationshipIds = Array.isArray(veterinarian.veterinarianClinics)
    ? veterinarian.veterinarianClinics
      .map((item) => Number(item?.clinic?.id_clinica || 0))
      .filter((value) => Number.isInteger(value) && value > 0)
    : [];

  const legacyClinicId = Number(veterinarian?.clinic?.id_clinica || 0);
  if (legacyClinicId > 0) {
    relationshipIds.push(legacyClinicId);
  }

  return [...new Set(relationshipIds)];
}

export function normalizeVeterinarianClinicIdsInput(body = {}, {
  preserveExisting = false,
  existingClinicIds = [],
} = {}) {
  if (body.clinic_ids === undefined && body.clinic_id === undefined) {
    return {
      shouldSync: false,
      clinicIds: preserveExisting ? [...existingClinicIds] : [],
    };
  }

  const rawClinicIds = body.clinic_ids !== undefined
    ? body.clinic_ids
    : body.clinic_id === null
      ? []
      : body.clinic_id === undefined
        ? existingClinicIds
        : [body.clinic_id];

  const clinicIds = [...new Set(
    (Array.isArray(rawClinicIds) ? rawClinicIds : [rawClinicIds])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  return {
    shouldSync: true,
    clinicIds,
  };
}

export function getLegacyClinicIdFromClinicIds(clinicIds = []) {
  const normalizedIds = (Array.isArray(clinicIds) ? clinicIds : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return normalizedIds[0] || null;
}

function mapClinicSummary(clinic) {
  if (!clinic) return null;

  return {
    id_clinica: clinic.id_clinica,
    nombre: clinic.nombre || "",
    activo: Boolean(clinic.activo),
    location: mapLocationSummary(clinic.location),
  };
}

function mapVeterinarian(veterinarian) {
  if (!veterinarian) return null;

  const associationClinics = Array.isArray(veterinarian.veterinarianClinics)
    ? veterinarian.veterinarianClinics
      .map((item) => item?.clinic)
      .filter(Boolean)
      .map(mapClinicSummary)
    : [];

  const legacyClinic = mapClinicSummary(veterinarian.clinic);
  const clinicsMap = new Map();

  [...associationClinics, legacyClinic].filter(Boolean).forEach((clinic) => {
    clinicsMap.set(Number(clinic.id_clinica), clinic);
  });

  const clinics = Array.from(clinicsMap.values()).sort((left, right) =>
    String(left.nombre || "").localeCompare(String(right.nombre || ""), "es"),
  );
  const primaryClinic = legacyClinic || clinics[0] || null;

  return {
    id_veterinario: veterinarian.id_veterinario,
    nombre: veterinarian.nombre || "",
    apellido: veterinarian.apellido || "",
    email: veterinarian.email || "",
    telefono: veterinarian.telefono || "",
    activo: Boolean(veterinarian.activo),
    clinic: primaryClinic,
    clinics,
    clinicIds: clinics.map((clinic) => Number(clinic.id_clinica)),
    createdAt: veterinarian.createdAt || null,
    updatedAt: veterinarian.updatedAt || null,
  };
}

async function getVeterinarianWithRelations(repository, veterinarianId) {
  return repository.findOne({
    where: { id_veterinario: Number(veterinarianId) },
    relations: {
      clinic: {
        location: locationRelations,
      },
      veterinarianClinics: {
        clinic: {
          location: locationRelations,
        },
      },
    },
  });
}

async function ensureUniqueVeterinarian(repository, body, excludingId = null) {
  const conflicts = await Promise.all([
    repository.findOne({ where: { email: body.email.trim() } }),
    repository.findOne({ where: { telefono: body.telefono.trim() } }),
  ]);

  const duplicated = conflicts.find(
    (item) => item && Number(item.id_veterinario) !== Number(excludingId),
  );

  if (!duplicated) return;

  if (duplicated.email === body.email.trim()) {
    throw new Error("Ya existe un veterinario con ese email.");
  }

  throw new Error("Ya existe un veterinario con ese telefono.");
}

async function validateActiveClinicsOrThrow(manager, clinicIds = []) {
  const normalizedClinicIds = [...new Set(
    (Array.isArray(clinicIds) ? clinicIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  if (normalizedClinicIds.length === 0) {
    return [];
  }

  const clinicRepository = manager.getRepository(VetClinic);
  const clinics = await clinicRepository.find({
    where: normalizedClinicIds.map((id) => ({ id_clinica: id })),
  });

  if (clinics.length !== normalizedClinicIds.length) {
    throw new Error("Una o mas clinicas seleccionadas no existen.");
  }

  if (clinics.some((clinic) => clinic.activo === false)) {
    throw new Error("Solo puedes asociar clinicas activas.");
  }

  return normalizedClinicIds;
}

export async function syncVeterinarianClinicMemberships(manager, veterinarianId, clinicIds = []) {
  const veterinarianClinicRepository = manager.getRepository(VeterinarianClinic);
  const normalizedClinicIds = await validateActiveClinicsOrThrow(manager, clinicIds);

  const existingRelations = await veterinarianClinicRepository.find({
    where: {
      veterinarian: { id_veterinario: Number(veterinarianId) },
    },
    relations: {
      clinic: true,
    },
  });

  const existingClinicIds = new Set(
    existingRelations.map((item) => Number(item?.clinic?.id_clinica || 0)),
  );

  const relationsToCreate = normalizedClinicIds
    .filter((clinicId) => !existingClinicIds.has(clinicId))
    .map((clinicId) => veterinarianClinicRepository.create({
      veterinarian: { id_veterinario: Number(veterinarianId) },
      clinic: { id_clinica: clinicId },
    }));

  const relationsToDelete = existingRelations.filter(
    (item) => !normalizedClinicIds.includes(Number(item?.clinic?.id_clinica || 0)),
  );

  if (relationsToCreate.length > 0) {
    await veterinarianClinicRepository.save(relationsToCreate);
  }

  if (relationsToDelete.length > 0) {
    await veterinarianClinicRepository.remove(relationsToDelete);
  }
}

export async function createVeterinarianService(body) {
  try {
    const veterinarian = await AppDataSource.transaction(async (manager) => {
      const veterinarianRepository = manager.getRepository(Veterinarian);

      await ensureUniqueVeterinarian(veterinarianRepository, body);

      const { clinicIds } = normalizeVeterinarianClinicIdsInput(body);
      const validatedClinicIds = await validateActiveClinicsOrThrow(manager, clinicIds);
      const directClinicId = getLegacyClinicIdFromClinicIds(validatedClinicIds);
      const newVeterinarian = veterinarianRepository.create({
        nombre: body.nombre.trim(),
        apellido: body.apellido.trim(),
        email: body.email.trim(),
        telefono: body.telefono.trim(),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        clinic: directClinicId ? { id_clinica: directClinicId } : null,
      });

      const savedVeterinarian = await veterinarianRepository.save(newVeterinarian);

      if (validatedClinicIds.length > 0) {
        await syncVeterinarianClinicMemberships(
          manager,
          savedVeterinarian.id_veterinario,
          validatedClinicIds,
        );
      }

      return getVeterinarianWithRelations(
        veterinarianRepository,
        savedVeterinarian.id_veterinario,
      );
    });

    return [mapVeterinarian(veterinarian), null];
  } catch (error) {
    console.error("Error al crear veterinario:", error);
    return [null, error.message || "Error interno al crear veterinario"];
  }
}

export async function getVeterinarianService(query) {
  try {
    const veterinarianRepository = AppDataSource.getRepository(Veterinarian);
    const veterinarianFound = await getVeterinarianWithRelations(
      veterinarianRepository,
      query.id,
    );

    if (!veterinarianFound) return [null, "Veterinario no encontrado"];

    return [mapVeterinarian(veterinarianFound), null];
  } catch (error) {
    console.error("Error al obtener el veterinario:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getVeterinariansService(query = {}) {
  try {
    const veterinarianRepository = AppDataSource.getRepository(Veterinarian);
    const where = {};

    const active = parseBooleanFilter(query.activo);
    if (active !== undefined) {
      where.activo = active;
    }

    const veterinarians = await veterinarianRepository.find({
      where,
      relations: {
        clinic: {
          location: locationRelations,
        },
        veterinarianClinics: {
          clinic: {
            location: locationRelations,
          },
        },
      },
      order: {
        nombre: "ASC",
        apellido: "ASC",
      },
    });

    const normalizedClinicId = Number(query.clinic_id);
    const filteredVeterinarians = query.clinic_id
      ? veterinarians.filter((item) =>
        getNormalizedVeterinarianClinicIds(item).includes(normalizedClinicId),
      )
      : veterinarians;

    return [filteredVeterinarians.map(mapVeterinarian), null];
  } catch (error) {
    console.error("Error al obtener veterinarios:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateVeterinarianService(query, body) {
  try {
    const veterinarian = await AppDataSource.transaction(async (manager) => {
      const veterinarianRepository = manager.getRepository(Veterinarian);

      const veterinarianFound = await getVeterinarianWithRelations(
        veterinarianRepository,
        query.id,
      );

      if (!veterinarianFound) return null;

      const nextEmail = body.email !== undefined ? body.email.trim() : veterinarianFound.email;
      const nextTelefono =
        body.telefono !== undefined ? body.telefono.trim() : veterinarianFound.telefono;

      if (body.email !== undefined || body.telefono !== undefined) {
        await ensureUniqueVeterinarian(
          veterinarianRepository,
          {
            email: nextEmail,
            telefono: nextTelefono,
          },
          veterinarianFound.id_veterinario,
        );
      }

      const currentClinicIds = getNormalizedVeterinarianClinicIds(veterinarianFound);
      const { shouldSync, clinicIds } = normalizeVeterinarianClinicIdsInput(body, {
        preserveExisting: true,
        existingClinicIds: currentClinicIds,
      });
      const validatedClinicIds = shouldSync
        ? await validateActiveClinicsOrThrow(manager, clinicIds)
        : currentClinicIds;
      const shouldTouchLegacyClinic = body.clinic_ids !== undefined || body.clinic_id !== undefined;
      const nextLegacyClinicId = shouldTouchLegacyClinic
        ? getLegacyClinicIdFromClinicIds(validatedClinicIds)
        : Number(veterinarianFound?.clinic?.id_clinica || 0) || null;

      const partialVeterinarian = veterinarianRepository.create({
        id_veterinario: Number(veterinarianFound.id_veterinario),
        nombre: body.nombre !== undefined ? body.nombre.trim() : veterinarianFound.nombre,
        apellido: body.apellido !== undefined ? body.apellido.trim() : veterinarianFound.apellido,
        email: body.email !== undefined ? nextEmail : veterinarianFound.email,
        telefono: body.telefono !== undefined ? nextTelefono : veterinarianFound.telefono,
        activo: body.activo !== undefined ? Boolean(body.activo) : Boolean(veterinarianFound.activo),
      });

      if (shouldTouchLegacyClinic) {
        partialVeterinarian.clinic = nextLegacyClinicId
          ? { id_clinica: nextLegacyClinicId }
          : null;
      }

      await veterinarianRepository.save(partialVeterinarian);

      if (shouldSync) {
        await syncVeterinarianClinicMemberships(
          manager,
          veterinarianFound.id_veterinario,
          validatedClinicIds,
        );
      }

      return getVeterinarianWithRelations(
        veterinarianRepository,
        veterinarianFound.id_veterinario,
      );
    });

    if (!veterinarian) return [null, "Veterinario no encontrado"];

    return [mapVeterinarian(veterinarian), null];
  } catch (error) {
    console.error("Error al modificar el veterinario:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteVeterinarianService(query) {
  try {
    const veterinarian = await AppDataSource.transaction(async (manager) => {
      const veterinarianRepository = manager.getRepository(Veterinarian);

      const veterinarianFound = await getVeterinarianWithRelations(
        veterinarianRepository,
        query.id,
      );

      if (!veterinarianFound) return null;

      await veterinarianRepository.save(
        veterinarianRepository.create({
          id_veterinario: Number(veterinarianFound.id_veterinario),
          activo: false,
        }),
      );

      return getVeterinarianWithRelations(
        veterinarianRepository,
        veterinarianFound.id_veterinario,
      );
    });

    if (!veterinarian) return [null, "Veterinario no encontrado"];

    return [mapVeterinarian(veterinarian), null];
  } catch (error) {
    console.error("Error al eliminar el veterinario:", error);
    return [null, "Error interno del servidor"];
  }
}

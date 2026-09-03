"use strict";

import { AppDataSource } from "../../config/configDb.js";
import Veterinarian from "../../entities/animalConcept/veterinarian.entity.js";
import VeterinarianClinic from "../../entities/animalConcept/veterinarian_clinic.entity.js";
import VetClinic from "../../entities/animalConcept/vet_clinic.entity.js";
import {
  createManagedLocation,
  locationRelations,
  mapLocationSummary,
  updateManagedLocation,
} from "../location.shared.js";

function mapVeterinarianSummary(veterinarian) {
  if (!veterinarian) return null;

  return {
    id_veterinario: veterinarian.id_veterinario,
    nombre: veterinarian.nombre || "",
    apellido: veterinarian.apellido || "",
    email: veterinarian.email || "",
    telefono: veterinarian.telefono || "",
    activo: Boolean(veterinarian.activo),
  };
}

function mergeVeterinariansFromClinic(clinic) {
  const legacyVeterinarians = Array.isArray(clinic.Veterinarian)
    ? clinic.Veterinarian
    : [];
  const relationshipVeterinarians = Array.isArray(clinic.veterinarianClinics)
    ? clinic.veterinarianClinics
      .map((item) => item?.veterinarian)
      .filter(Boolean)
    : [];

  const uniqueMap = new Map();
  [...relationshipVeterinarians, ...legacyVeterinarians].forEach((veterinarian) => {
    uniqueMap.set(Number(veterinarian.id_veterinario), veterinarian);
  });

  return Array.from(uniqueMap.values())
    .sort((left, right) =>
      `${left.nombre || ""} ${left.apellido || ""}`.localeCompare(
        `${right.nombre || ""} ${right.apellido || ""}`,
        "es",
      ),
    )
    .map(mapVeterinarianSummary);
}

function mapClinic(clinic) {
  if (!clinic) return null;

  return {
    id_clinica: clinic.id_clinica,
    nombre: clinic.nombre || "",
    activo: Boolean(clinic.activo),
    location: mapLocationSummary(clinic.location),
    veterinarians: mergeVeterinariansFromClinic(clinic),
    createdAt: clinic.createdAt || null,
    updatedAt: clinic.updatedAt || null,
  };
}

function parseBooleanFilter(value) {
  if (value === undefined) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

export async function syncClinicVeterinarians(manager, clinicId, veterinarianIds = []) {
  const veterinarianRepository = manager.getRepository(Veterinarian);
  const veterinarianClinicRepository = manager.getRepository(VeterinarianClinic);
  const normalizedVeterinarianIds = [...new Set(
    (Array.isArray(veterinarianIds) ? veterinarianIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];

  const veterinarians = normalizedVeterinarianIds.length > 0
    ? await veterinarianRepository.find({
      where: normalizedVeterinarianIds.map((id) => ({
        id_veterinario: id,
        activo: true,
      })),
      relations: {
        clinic: true,
      },
    })
    : [];

  if (veterinarians.length !== normalizedVeterinarianIds.length) {
    throw new Error(
      "Uno o mas veterinarios no existen o estan inactivos. Solo puedes asociar veterinarios activos.",
    );
  }

  const existingRelations = await veterinarianClinicRepository.find({
    where: {
      clinic: { id_clinica: Number(clinicId) },
    },
    relations: {
      veterinarian: {
        clinic: true,
      },
      clinic: true,
    },
  });

  const existingIds = new Set(
    existingRelations.map((item) => Number(item?.veterinarian?.id_veterinario || 0)),
  );

  const relationsToCreate = veterinarians
    .filter((item) => !existingIds.has(Number(item.id_veterinario)))
    .map((item) => veterinarianClinicRepository.create({
      veterinarian: { id_veterinario: Number(item.id_veterinario) },
      clinic: { id_clinica: Number(clinicId) },
    }));

  const relationsToDelete = existingRelations.filter(
    (item) => !normalizedVeterinarianIds.includes(Number(item?.veterinarian?.id_veterinario || 0)),
  );

  if (relationsToCreate.length > 0) {
    await veterinarianClinicRepository.save(relationsToCreate);
  }

  if (relationsToDelete.length > 0) {
    await veterinarianClinicRepository.remove(relationsToDelete);
  }

  for (const veterinarian of veterinarians) {
    if (!veterinarian.clinic) {
      await veterinarianRepository.save(
        veterinarianRepository.create({
          id_veterinario: Number(veterinarian.id_veterinario),
          clinic: { id_clinica: Number(clinicId) },
        }),
      );
    }
  }

  for (const relation of relationsToDelete) {
    const veterinarian = relation?.veterinarian;
    if (!veterinarian) {
      continue;
    }

    const refreshedRelations = await veterinarianClinicRepository.find({
      where: {
        veterinarian: { id_veterinario: Number(veterinarian.id_veterinario) },
      },
      relations: {
        clinic: true,
      },
    });

    const hasCurrentLegacyClinic =
      Number(veterinarian?.clinic?.id_clinica || 0) === Number(clinicId);

    if (!hasCurrentLegacyClinic) {
      continue;
    }

    const nextPrimaryClinicId = Number(refreshedRelations[0]?.clinic?.id_clinica || 0);
    await veterinarianRepository.save(
      veterinarianRepository.create({
        id_veterinario: Number(veterinarian.id_veterinario),
        clinic: nextPrimaryClinicId
          ? { id_clinica: nextPrimaryClinicId }
          : null,
      }),
    );
  }
}

async function getClinicWithRelations(repository, clinicId) {
  return repository.findOne({
    where: { id_clinica: Number(clinicId) },
    relations: {
      location: locationRelations,
      Veterinarian: true,
      veterinarianClinics: {
        veterinarian: true,
      },
    },
  });
}

export async function createVetClinicService(body) {
  try {
    const clinic = await AppDataSource.transaction(async (manager) => {
      const vetClinicRepository = manager.getRepository(VetClinic);
      const existingClinic = await vetClinicRepository.findOne({
        where: { nombre: body.nombre.trim() },
      });

      if (existingClinic) {
        throw new Error("Ya existe una clinica con ese nombre.");
      }

      const location = await createManagedLocation(manager, {
        ...body.location,
        tipo: "CLINICA",
        nombre_ubicacion: body.nombre.trim(),
      });

      const newClinic = vetClinicRepository.create({
        nombre: body.nombre.trim(),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
        location: { ubicacion_id: Number(location.ubicacion_id) },
      });

      const savedClinic = await vetClinicRepository.save(newClinic);
      await syncClinicVeterinarians(
        manager,
        savedClinic.id_clinica,
        body.veterinarian_ids,
      );
      return getClinicWithRelations(vetClinicRepository, savedClinic.id_clinica);
    });

    return [mapClinic(clinic), null];
  } catch (error) {
    console.error("Error al crear clinica:", error);
    return [null, error.message || "Error interno al crear clinica"];
  }
}

export async function getVetClinicService(query) {
  try {
    const vetClinicRepository = AppDataSource.getRepository(VetClinic);
    const clinicFound = await getClinicWithRelations(vetClinicRepository, query.id);

    if (!clinicFound) return [null, "Clinica no encontrada"];

    return [mapClinic(clinicFound), null];
  } catch (error) {
    console.error("Error al obtener la clinica:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getVetClinicsService(query = {}) {
  try {
    const vetClinicRepository = AppDataSource.getRepository(VetClinic);
    const where = {};
    const active = parseBooleanFilter(query.activo);

    if (active !== undefined) {
      where.activo = active;
    }

    const clinics = await vetClinicRepository.find({
      where,
      relations: {
        location: locationRelations,
        Veterinarian: true,
        veterinarianClinics: {
          veterinarian: true,
        },
      },
      order: {
        nombre: "ASC",
      },
    });

    const normalizedSearch = String(query.search || "").trim().toLowerCase();
    const normalizedRegionId = Number(query.region_id);
    const normalizedComunaId = Number(query.comuna_id);

    const filteredClinics = clinics.filter((clinic) => {
      const matchesSearch = !normalizedSearch
        || [
          clinic.nombre,
          clinic.location?.direccion,
          clinic.location?.region?.nombre,
          clinic.location?.comuna?.nombre,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const matchesRegion = !normalizedRegionId
        || Number(clinic.location?.region?.id_region || 0) === normalizedRegionId;

      const matchesComuna = !normalizedComunaId
        || Number(clinic.location?.comuna?.id_comuna || 0) === normalizedComunaId;

      return matchesSearch && matchesRegion && matchesComuna;
    });

    return [filteredClinics.map(mapClinic), null];
  } catch (error) {
    console.error("Error al obtener clinicas:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateVetClinicService(query, body) {
  try {
    const clinic = await AppDataSource.transaction(async (manager) => {
      const vetClinicRepository = manager.getRepository(VetClinic);
      const clinicFound = await vetClinicRepository.findOne({
        where: { id_clinica: Number(query.id) },
        relations: {
          location: locationRelations,
        },
      });

      if (!clinicFound) {
        throw new Error("Clinica no encontrada");
      }

      let nextClinicName = clinicFound.nombre;
      if (body.nombre !== undefined) {
        const clinicWithSameName = await vetClinicRepository.findOne({
          where: { nombre: body.nombre.trim() },
        });

        if (
          clinicWithSameName
          && Number(clinicWithSameName.id_clinica) !== Number(clinicFound.id_clinica)
        ) {
          throw new Error("Ya existe una clinica con ese nombre.");
        }

        nextClinicName = body.nombre.trim();
      }

      const nextActive = body.activo !== undefined
        ? Boolean(body.activo)
        : Boolean(clinicFound.activo);

      await vetClinicRepository.save(
        vetClinicRepository.create({
          id_clinica: Number(clinicFound.id_clinica),
          nombre: nextClinicName,
          activo: nextActive,
          location: clinicFound.location?.ubicacion_id
            ? { ubicacion_id: Number(clinicFound.location.ubicacion_id) }
            : clinicFound.location,
        }),
      );

      await updateManagedLocation(manager, clinicFound.location?.ubicacion_id, {
        ...(body.location || {}),
        tipo: "CLINICA",
        nombre_ubicacion: nextClinicName,
        activo: nextActive,
      });

      if (body.veterinarian_ids !== undefined) {
        await syncClinicVeterinarians(
          manager,
          clinicFound.id_clinica,
          body.veterinarian_ids,
        );
      }

      return getClinicWithRelations(vetClinicRepository, clinicFound.id_clinica);
    });

    return [mapClinic(clinic), null];
  } catch (error) {
    console.error("Error al modificar la clinica:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteVetClinicService(query) {
  try {
    const clinic = await AppDataSource.transaction(async (manager) => {
      const vetClinicRepository = manager.getRepository(VetClinic);
      const clinicFound = await vetClinicRepository.findOne({
        where: { id_clinica: Number(query.id) },
        relations: {
          location: locationRelations,
        },
      });

      if (!clinicFound) {
        throw new Error("Clinica no encontrada");
      }

      await vetClinicRepository.save(
        vetClinicRepository.create({
          id_clinica: Number(clinicFound.id_clinica),
          activo: false,
          nombre: clinicFound.nombre,
          location: clinicFound.location?.ubicacion_id
            ? { ubicacion_id: Number(clinicFound.location.ubicacion_id) }
            : clinicFound.location,
        }),
      );

      await updateManagedLocation(manager, clinicFound.location?.ubicacion_id, {
        tipo: "CLINICA",
        nombre_ubicacion: clinicFound.nombre,
        activo: false,
      });

      return getClinicWithRelations(vetClinicRepository, clinicFound.id_clinica);
    });

    return [mapClinic(clinic), null];
  } catch (error) {
    console.error("Error al eliminar la clinica:", error);
    return [null, "Error interno del servidor"];
  }
}

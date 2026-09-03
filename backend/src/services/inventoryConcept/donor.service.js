"use strict";

import { AppDataSource } from "../../config/configDb.js";
import Donor from "../../entities/donor.entity.js";
import { normalizeNullableString } from "../location.shared.js";

function normalizeDonorEmailForPersistence(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeDonorPhoneForComparison(value) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  return normalized || null;
}

function normalizeDonorInstagramForPersistence(value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;

  return normalized
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "") || null;
}

function findDuplicateDonorInCollection(donors = [], candidate = {}, excludeId = null) {
  const candidateEmail = normalizeDonorEmailForPersistence(candidate.email);
  const candidatePhone = normalizeDonorPhoneForComparison(candidate.telefono);
  const candidateInstagram = normalizeDonorInstagramForPersistence(candidate.usuario_instagram);

  for (const donor of donors) {
    if (!donor || (excludeId && Number(donor.donante_id) === Number(excludeId))) continue;

    if (
      candidateEmail
      && normalizeDonorEmailForPersistence(donor.email) === candidateEmail
    ) {
      return { donor, matchedBy: "email" };
    }

    if (
      candidatePhone
      && normalizeDonorPhoneForComparison(donor.telefono) === candidatePhone
    ) {
      return { donor, matchedBy: "telefono" };
    }

    if (
      candidateInstagram
      && normalizeDonorInstagramForPersistence(donor.usuario_instagram) === candidateInstagram
    ) {
      return { donor, matchedBy: "instagram" };
    }
  }

  return null;
}

async function findDuplicateDonor(repository, candidate, excludeId = null) {
  const donors = await repository.find();
  return findDuplicateDonorInCollection(donors, candidate, excludeId);
}

function mapDonor(donor) {
  if (!donor) return null;

  return {
    donante_id: donor.donante_id,
    nombre: donor.nombre || "",
    apellido: donor.apellido || null,
    email: donor.email || null,
    telefono: donor.telefono || null,
    usuario_instagram: donor.usuario_instagram || null,
    direccion: donor.direccion || null,
    observaciones: donor.observaciones || null,
    activo: Boolean(donor.activo),
  };
}

async function getDonorWithRelations(repository, donorId) {
  return repository.findOne({
    where: { donante_id: Number(donorId) },
    relations: {
      donation: true,
      transactions: true,
      payment_orders: true,
    },
  });
}

function donorHasHistory(donor) {
  return (donor?.donation || []).length > 0
    || (donor?.transactions || []).length > 0
    || (donor?.payment_orders || []).length > 0;
}

function buildDuplicateEmailMessage() {
  return "Ya existe un donante con el mismo correo electrónico.";
}

function buildDuplicateDonorMessage(matchedBy) {
  switch (matchedBy) {
    case "telefono":
      return "Ya existe un donante con el mismo telefono.";
    case "instagram":
      return "Ya existe un donante con el mismo usuario de Instagram.";
    case "email":
    default:
      return buildDuplicateEmailMessage();
  }
}

export async function createDonorService(body) {
  try {
    const donor = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donor);
      const normalizedDonor = {
        nombre: body.nombre.trim(),
        apellido: normalizeNullableString(body.apellido),
        email: normalizeDonorEmailForPersistence(body.email),
        telefono: normalizeNullableString(body.telefono),
        usuario_instagram: normalizeDonorInstagramForPersistence(body.usuario_instagram),
        direccion: normalizeNullableString(body.direccion),
        observaciones: normalizeNullableString(body.observaciones),
        activo: body.activo !== undefined ? Boolean(body.activo) : true,
      };

      const duplicate = await findDuplicateDonor(repository, normalizedDonor);
      if (duplicate) {
        throw new Error(buildDuplicateDonorMessage(duplicate.matchedBy));
      }

      const newDonor = repository.create(normalizedDonor);

      const savedDonor = await repository.save(newDonor);
      return getDonorWithRelations(repository, savedDonor.donante_id);
    });

    return [mapDonor(donor), null];
  } catch (error) {
    console.error("Error al crear donante:", error);
    if (error?.code === "23505") {
      return [null, buildDuplicateEmailMessage()];
    }
    return [null, error.message || "Error interno al crear donante"];
  }
}

export async function getDonorService(query) {
  try {
    const repository = AppDataSource.getRepository(Donor);
    const donor = await getDonorWithRelations(repository, query.donante_id);

    if (!donor) return [null, "Donante no encontrado"];

    return [mapDonor(donor), null];
  } catch (error) {
    console.error("Error al obtener donante:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getDonorsService() {
  try {
    const repository = AppDataSource.getRepository(Donor);
    const donors = await repository.find({
      order: {
        nombre: "ASC",
        donante_id: "ASC",
      },
    });

    if (!donors || donors.length === 0) return [null, "No hay donantes"];

    return [donors.map(mapDonor), null];
  } catch (error) {
    console.error("Error al obtener donantes:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateDonorService(query, body) {
  try {
    const donor = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donor);
      const donorFound = await getDonorWithRelations(repository, query.donante_id);

      if (!donorFound) {
        throw new Error("Donante no encontrado");
      }

      const candidate = {
        email:
          body.email !== undefined
            ? normalizeDonorEmailForPersistence(body.email)
            : donorFound.email,
        telefono:
          body.telefono !== undefined
            ? normalizeNullableString(body.telefono)
            : donorFound.telefono,
        usuario_instagram:
          body.usuario_instagram !== undefined
            ? normalizeDonorInstagramForPersistence(body.usuario_instagram)
            : donorFound.usuario_instagram,
      };

      const duplicate = await findDuplicateDonor(
        repository,
        candidate,
        donorFound.donante_id,
      );
      if (duplicate) {
        throw new Error(buildDuplicateDonorMessage(duplicate.matchedBy));
      }

      if (body.nombre !== undefined) donorFound.nombre = body.nombre.trim();
      if (body.apellido !== undefined) donorFound.apellido = normalizeNullableString(body.apellido);
      if (body.email !== undefined) donorFound.email = normalizeDonorEmailForPersistence(body.email);
      if (body.telefono !== undefined) donorFound.telefono = normalizeNullableString(body.telefono);
      if (body.usuario_instagram !== undefined) {
        donorFound.usuario_instagram = normalizeDonorInstagramForPersistence(body.usuario_instagram);
      }
      if (body.direccion !== undefined) donorFound.direccion = normalizeNullableString(body.direccion);
      if (body.observaciones !== undefined) {
        donorFound.observaciones = normalizeNullableString(body.observaciones);
      }
      if (body.activo !== undefined) donorFound.activo = Boolean(body.activo);

      await repository.save(donorFound);
      return getDonorWithRelations(repository, donorFound.donante_id);
    });

    return [mapDonor(donor), null];
  } catch (error) {
    console.error("Error al actualizar donante:", error);
    if (error?.code === "23505") {
      return [null, buildDuplicateEmailMessage()];
    }
    return [null, error.message || "Error interno al actualizar donante"];
  }
}

export async function deleteDonorService(query) {
  try {
    const donor = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Donor);
      const donorFound = await getDonorWithRelations(repository, query.donante_id);

      if (!donorFound) {
        throw new Error("Donante no encontrado");
      }

      if (donorHasHistory(donorFound)) {
        throw new Error(
          "No se puede eliminar el donante porque posee registros asociados. Puedes desactivarlo para impedir nuevas asociaciones.",
        );
      }

      return repository.remove(donorFound);
    });

    return [mapDonor(donor), null];
  } catch (error) {
    console.error("Error al eliminar donante:", error);
    return [null, error.message || "Error interno al eliminar donante"];
  }
}

export {
  donorHasHistory,
  findDuplicateDonorInCollection,
  mapDonor,
  normalizeDonorEmailForPersistence,
  normalizeDonorInstagramForPersistence,
  normalizeDonorPhoneForComparison,
};

"use strict";

import Veterinarian from "../../entities/animalConcept/veterinarian.entity.js";
import VetClinic from "../../entities/animalConcept/vet_clinic.entity.js";
import VeterinarianClinic from "../../entities/animalConcept/veterinarian_clinic.entity.js";
import User from "../../entities/user.entity.js";

export const CLINIC_NOT_AVAILABLE_MESSAGE =
  "La clínica seleccionada no existe o ya no está disponible.";
export const VETERINARIAN_CLINIC_MISMATCH_MESSAGE =
  "El veterinario seleccionado no pertenece a la clínica indicada.";
export const INVALID_DECIMAL_MESSAGE = "Ingresa un valor numérico válido.";
export const INVALID_DATE_MESSAGE = "Revisa las fechas ingresadas.";

function isEmptyValue(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

export function normalizeOptionalText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function normalizeRequiredText(value, fallbackMessage = "Este campo es obligatorio.") {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(fallbackMessage);
  }

  return normalized;
}

export function parseLocalizedDecimal(value, {
  required = false,
  allowNull = true,
  errorMessage = INVALID_DECIMAL_MESSAGE,
} = {}) {
  if (isEmptyValue(value)) {
    if (required) {
      throw new Error(errorMessage);
    }

    return allowNull ? null : undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(errorMessage);
    }

    return value;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(errorMessage);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed;
}

export function normalizeDateInput(value, { required = false } = {}) {
  if (isEmptyValue(value)) {
    if (required) {
      throw new Error(INVALID_DATE_MESSAGE);
    }

    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(INVALID_DATE_MESSAGE);
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(INVALID_DATE_MESSAGE);
  }

  return normalized;
}

function compareIsoDates(left, right) {
  if (!left || !right) return 0;
  return String(left).localeCompare(String(right));
}

export function validateHospitalizationDates({
  fechaIngreso,
  fechaAlta,
  fechaControlPostAlta,
}) {
  if (fechaAlta && compareIsoDates(fechaAlta, fechaIngreso) < 0) {
    throw new Error(INVALID_DATE_MESSAGE);
  }

  if (fechaControlPostAlta && compareIsoDates(fechaControlPostAlta, fechaIngreso) < 0) {
    throw new Error(INVALID_DATE_MESSAGE);
  }

  if (
    fechaAlta
    && fechaControlPostAlta
    && compareIsoDates(fechaControlPostAlta, fechaAlta) < 0
  ) {
    throw new Error(INVALID_DATE_MESSAGE);
  }
}

export function validateVetCheckupDates({ fecha, fechaProximoControl }) {
  if (
    fecha
    && fechaProximoControl
    && compareIsoDates(fechaProximoControl, fecha) <= 0
  ) {
    throw new Error(INVALID_DATE_MESSAGE);
  }
}

export async function resolveClinicOrThrow(manager, clinicId) {
  const normalizedClinicId = Number(clinicId);

  if (!Number.isInteger(normalizedClinicId) || normalizedClinicId <= 0) {
    throw new Error(CLINIC_NOT_AVAILABLE_MESSAGE);
  }

  const clinic = await manager.getRepository(VetClinic).findOne({
    where: { id_clinica: normalizedClinicId },
    relations: {
      location: true,
    },
  });

  if (!clinic || clinic.activo === false) {
    throw new Error(CLINIC_NOT_AVAILABLE_MESSAGE);
  }

  return clinic;
}

export async function resolveVeterinarianForClinic(manager, clinicId, veterinarianId) {
  if (isEmptyValue(veterinarianId)) {
    return null;
  }

  const normalizedVeterinarianId = Number(veterinarianId);
  if (!Number.isInteger(normalizedVeterinarianId) || normalizedVeterinarianId <= 0) {
    throw new Error(VETERINARIAN_CLINIC_MISMATCH_MESSAGE);
  }

  const veterinarianRepository = manager.getRepository(Veterinarian);
  const veterinarian = await veterinarianRepository.findOne({
    where: { id_veterinario: normalizedVeterinarianId },
    relations: {
      clinic: true,
      veterinarianClinics: {
        clinic: true,
      },
    },
  });

  if (!veterinarian || veterinarian.activo === false) {
    throw new Error(VETERINARIAN_CLINIC_MISMATCH_MESSAGE);
  }

  const normalizedClinicId = Number(clinicId);
  const belongsToClinic = Array.isArray(veterinarian.veterinarianClinics)
    ? veterinarian.veterinarianClinics.some(
        (item) => Number(item?.clinic?.id_clinica) === normalizedClinicId,
      )
    : false;

  const belongsToLegacyClinic =
    Number(veterinarian?.clinic?.id_clinica || 0) === normalizedClinicId;

  if (!belongsToClinic && !belongsToLegacyClinic) {
    throw new Error(VETERINARIAN_CLINIC_MISMATCH_MESSAGE);
  }

  if (!belongsToClinic && belongsToLegacyClinic) {
    const veterinarianClinicRepository = manager.getRepository(VeterinarianClinic);
    const existingRelation = await veterinarianClinicRepository.findOne({
      where: {
        veterinarian: { id_veterinario: normalizedVeterinarianId },
        clinic: { id_clinica: normalizedClinicId },
      },
    });

    if (!existingRelation) {
      await veterinarianClinicRepository.save(
        veterinarianClinicRepository.create({
          veterinarian: { id_veterinario: normalizedVeterinarianId },
          clinic: { id_clinica: normalizedClinicId },
        }),
      );
    }
  }

  return veterinarian;
}

export async function resolveResponsibleUserOrThrow(manager, authContext = {}, existingUserId = null) {
  const targetUserId = existingUserId ?? authContext.userId;
  const normalizedUserId = Number(targetUserId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    throw new Error("No fue posible identificar al usuario autenticado.");
  }

  const user = await manager.getRepository(User).findOne({
    where: { id_usuario: normalizedUserId },
  });

  if (!user) {
    throw new Error("No fue posible identificar al usuario autenticado.");
  }

  return user;
}

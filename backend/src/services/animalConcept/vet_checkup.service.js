"use strict";

import VetCheckup from "../../entities/animalConcept/vet_checkup.entity.js";
import { AppDataSource } from "../../config/configDb.js";
import { assertSourceCanBeDeletedFinancially } from "../financialConcept/payableIntegration.service.js";
import {
  attachClinicalPayableSummary,
  sanitizeClinicalCollection,
  sanitizeClinicalRecord,
  syncClinicalPayable,
} from "./clinicalAccounting.shared.js";
import {
  normalizeDateInput,
  normalizeOptionalText,
  normalizeRequiredText,
  parseLocalizedDecimal,
  resolveClinicOrThrow,
  resolveResponsibleUserOrThrow,
  resolveVeterinarianForClinic,
  validateVetCheckupDates,
} from "./clinicalRecord.shared.js";

async function getNextVetCheckupNumber(vetCheckupRepository, animalId) {
  const existingCheckups = await vetCheckupRepository.find({
    where: { animal: { id_animal: Number(animalId) } },
    select: {
      numero_control: true,
    },
  });

  const maxControlNumber = existingCheckups.reduce((maxValue, checkup) => {
    const parsedNumber = Number.parseInt(checkup.numero_control, 10);

    if (Number.isNaN(parsedNumber)) {
      return maxValue;
    }

    return Math.max(maxValue, parsedNumber);
  }, 0);

  return String(maxControlNumber + 1);
}

async function getVetCheckupWithRelations(repository, checkupId) {
  return repository.findOne({
    where: { id_control_veterinario: Number(checkupId) },
    relations: {
      animal: true,
      veterinarian: true,
      clinic: true,
      user: true,
    },
  });
}

function buildVetCheckupPayload(body, context = {}) {
  const payload = {
    fecha:
      body.fecha !== undefined
        ? normalizeDateInput(body.fecha, { required: true })
        : context.current?.fecha,
    motivo:
      body.motivo !== undefined
        ? normalizeRequiredText(body.motivo)
        : context.current?.motivo,
    peso:
      body.peso !== undefined
        ? parseLocalizedDecimal(body.peso)
        : context.current?.peso ?? null,
    temperatura:
      body.temperatura !== undefined
        ? parseLocalizedDecimal(body.temperatura)
        : context.current?.temperatura ?? null,
    diagnostico:
      body.diagnostico !== undefined
        ? normalizeOptionalText(body.diagnostico)
        : context.current?.diagnostico ?? null,
    observaciones:
      body.observaciones !== undefined
        ? normalizeOptionalText(body.observaciones)
        : context.current?.observaciones ?? null,
    indicaciones_casa:
      body.indicaciones_casa !== undefined
        ? normalizeOptionalText(body.indicaciones_casa)
        : context.current?.indicaciones_casa ?? null,
    indicaciones_examenes:
      body.indicaciones_examenes !== undefined
        ? normalizeOptionalText(body.indicaciones_examenes)
        : context.current?.indicaciones_examenes ?? null,
    indicaciones_procedimiento:
      body.indicaciones_procedimiento !== undefined
        ? normalizeOptionalText(body.indicaciones_procedimiento)
        : context.current?.indicaciones_procedimiento ?? null,
    precio:
      body.precio !== undefined
        ? normalizeOptionalText(body.precio)
        : context.current?.precio ?? null,
    monto_total:
      body.monto_total !== undefined
        ? parseLocalizedDecimal(body.monto_total)
        : context.current?.monto_total ?? null,
    moneda:
      body.moneda !== undefined
        ? normalizeRequiredText(body.moneda)
        : context.current?.moneda || "CLP",
    genera_cuenta_por_pagar:
      body.genera_cuenta_por_pagar !== undefined
        ? Boolean(body.genera_cuenta_por_pagar)
        : Boolean(context.current?.genera_cuenta_por_pagar),
    fecha_vencimiento_pago:
      body.fecha_vencimiento_pago !== undefined
        ? normalizeDateInput(body.fecha_vencimiento_pago)
        : context.current?.fecha_vencimiento_pago ?? null,
    observacion_financiera:
      body.observacion_financiera !== undefined
        ? normalizeOptionalText(body.observacion_financiera)
        : context.current?.observacion_financiera ?? null,
    fecha_proximo_control:
      body.fecha_proximo_control !== undefined
        ? normalizeDateInput(body.fecha_proximo_control, { required: true })
        : context.current?.fecha_proximo_control,
    animal_id:
      body.animal_id !== undefined
        ? Number(body.animal_id)
        : Number(context.current?.animal?.id_animal),
  };

  validateVetCheckupDates({
    fecha: payload.fecha,
    fechaProximoControl: payload.fecha_proximo_control,
  });

  return payload;
}

export async function createVetCheckupService(body, authContext = {}) {
  try {
    const checkup = await AppDataSource.transaction(async (manager) => {
      const vetCheckupRepository = manager.getRepository(VetCheckup);
      const numeroControl = await getNextVetCheckupNumber(
        vetCheckupRepository,
        body.animal_id,
      );
      const clinic = await resolveClinicOrThrow(manager, body.clinic_id);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id,
      );
      const user = await resolveResponsibleUserOrThrow(manager, authContext);
      const payload = buildVetCheckupPayload(body);
      const { animal_id: animalId, ...checkupData } = payload;

      const newCheckup = vetCheckupRepository.create({
        numero_control: numeroControl,
        ...checkupData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(user.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const savedCheckup = await vetCheckupRepository.save(newCheckup);
      const checkupWithRelations = await getVetCheckupWithRelations(
        vetCheckupRepository,
        savedCheckup.id_control_veterinario,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        checkupWithRelations,
        {
          originType: "VET_CHECKUP",
          idField: "id_control_veterinario",
          eventLabel: "Control veterinario",
          fechaEmisionField: "fecha",
        },
        authContext,
      );
      const refreshedCheckup = await getVetCheckupWithRelations(
        vetCheckupRepository,
        savedCheckup.id_control_veterinario,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedCheckup, syncResult),
      );
    });

    return [checkup, null];
  } catch (error) {
    console.error("Error al crear control:", error);
    return [null, error.message || "Error interno al crear control"];
  }
}

export async function getVetCheckupService(query) {
  try {
    const { id } = query;
    const vetCheckupRepository = AppDataSource.getRepository(VetCheckup);
    const checkupFound = await getVetCheckupWithRelations(vetCheckupRepository, id);

    if (!checkupFound) return [null, "Control no encontrado"];

    return [sanitizeClinicalRecord(checkupFound), null];
  } catch (error) {
    console.error("Error al obtener el control:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getVetCheckupsService() {
  try {
    const vetCheckupRepository = AppDataSource.getRepository(VetCheckup);
    const checkups = await vetCheckupRepository.find({
      relations: {
        animal: true,
        veterinarian: true,
        clinic: true,
        user: true,
      },
    });

    if (!checkups || checkups.length === 0) return [null, "No hay controles"];

    return [sanitizeClinicalCollection(checkups), null];
  } catch (error) {
    console.error("Error al obtener controles:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateVetCheckupService(query, body, authContext = {}) {
  try {
    const checkup = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const vetCheckupRepository = manager.getRepository(VetCheckup);
      const checkupFound = await getVetCheckupWithRelations(vetCheckupRepository, id);

      if (!checkupFound) {
        throw new Error("Control no encontrado");
      }

      const nextClinicId = body.clinic_id !== undefined
        ? Number(body.clinic_id)
        : Number(checkupFound.clinic?.id_clinica);
      const clinic = await resolveClinicOrThrow(manager, nextClinicId);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id !== undefined
          ? body.veterinarian_id
          : checkupFound.veterinarian?.id_veterinario ?? null,
      );
      const payload = buildVetCheckupPayload(body, { current: checkupFound });
      const { animal_id: animalId, ...checkupData } = payload;

      await vetCheckupRepository.save({
        id_control_veterinario: Number(checkupFound.id_control_veterinario),
        numero_control: checkupFound.numero_control,
        ...checkupData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(checkupFound.user?.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const updatedCheckup = await getVetCheckupWithRelations(
        vetCheckupRepository,
        checkupFound.id_control_veterinario,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        updatedCheckup,
        {
          originType: "VET_CHECKUP",
          idField: "id_control_veterinario",
          eventLabel: "Control veterinario",
          fechaEmisionField: "fecha",
        },
        authContext,
      );
      const refreshedCheckup = await getVetCheckupWithRelations(
        vetCheckupRepository,
        checkupFound.id_control_veterinario,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedCheckup, syncResult),
      );
    });

    return [checkup, null];
  } catch (error) {
    console.error("Error al modificar el control:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteVetCheckupService(query) {
  try {
    const checkupDeleted = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const vetCheckupRepository = manager.getRepository(VetCheckup);
      const checkupFound = await vetCheckupRepository.findOne({
        where: { id_control_veterinario: id },
      });

      if (!checkupFound) {
        throw new Error("Control no encontrado");
      }

      await assertSourceCanBeDeletedFinancially(manager, {
        originType: "VET_CHECKUP",
        originId: id,
        sourceLabel: "el control veterinario",
      });

      return vetCheckupRepository.remove(checkupFound);
    });

    return [checkupDeleted, null];
  } catch (error) {
    console.error("Error al eliminar el control:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

"use strict";

import Procedure from "../../entities/animalConcept/procedure.entity.js";
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
} from "./clinicalRecord.shared.js";

async function getProcedureWithRelations(repository, procedureId) {
  return repository.findOne({
    where: { id_procedimiento: Number(procedureId) },
    relations: {
      veterinarian: true,
      clinic: true,
      user: true,
      animal: true,
    },
  });
}

function buildProcedurePayload(body, context = {}) {
  return {
    fecha_procedimiento:
      body.fecha_procedimiento !== undefined
        ? normalizeDateInput(body.fecha_procedimiento, { required: true })
        : context.current?.fecha_procedimiento,
    tipo:
      body.tipo !== undefined
        ? normalizeRequiredText(body.tipo)
        : context.current?.tipo,
    motivo:
      body.motivo !== undefined
        ? normalizeRequiredText(body.motivo)
        : context.current?.motivo,
    observaciones:
      body.observaciones !== undefined
        ? normalizeOptionalText(body.observaciones)
        : context.current?.observaciones ?? null,
    farmacos_recetados:
      body.farmacos_recetados !== undefined
        ? normalizeOptionalText(body.farmacos_recetados)
        : context.current?.farmacos_recetados ?? null,
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
    indicaciones:
      body.indicaciones !== undefined
        ? normalizeOptionalText(body.indicaciones)
        : context.current?.indicaciones ?? null,
    animal_id:
      body.animal_id !== undefined
        ? Number(body.animal_id)
        : Number(context.current?.animal?.id_animal),
  };
}

export async function createProcedureService(body, authContext = {}) {
  try {
    const procedure = await AppDataSource.transaction(async (manager) => {
      const procedureRepository = manager.getRepository(Procedure);
      const clinic = await resolveClinicOrThrow(manager, body.clinic_id);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id,
      );
      const user = await resolveResponsibleUserOrThrow(manager, authContext);
      const payload = buildProcedurePayload(body);
      const { animal_id: animalId, ...procedureData } = payload;

      const newProcedure = procedureRepository.create({
        ...procedureData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(user.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const savedProcedure = await procedureRepository.save(newProcedure);
      const procedureWithRelations = await getProcedureWithRelations(
        procedureRepository,
        savedProcedure.id_procedimiento,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        procedureWithRelations,
        {
          originType: "PROCEDURE",
          idField: "id_procedimiento",
          eventLabel: "Procedimiento",
          fechaEmisionField: "fecha_procedimiento",
        },
        authContext,
      );
      const refreshedProcedure = await getProcedureWithRelations(
        procedureRepository,
        savedProcedure.id_procedimiento,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedProcedure, syncResult),
      );
    });

    return [procedure, null];
  } catch (error) {
    console.error("Error al crear procedimiento:", error);
    return [null, error.message || "Error interno al crear procedimiento"];
  }
}

export async function getProcedureService(query) {
  try {
    const { id } = query;
    const procedureRepository = AppDataSource.getRepository(Procedure);
    const procedureFound = await getProcedureWithRelations(procedureRepository, id);

    if (!procedureFound) return [null, "Procedimiento no encontrado"];

    return [sanitizeClinicalRecord(procedureFound), null];
  } catch (error) {
    console.error("Error al obtener el procedimiento:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getProceduresService() {
  try {
    const procedureRepository = AppDataSource.getRepository(Procedure);
    const procedures = await procedureRepository.find({
      relations: {
        veterinarian: true,
        clinic: true,
        user: true,
        animal: true,
      },
    });

    if (!procedures || procedures.length === 0) {
      return [null, "No hay procedimientos"];
    }

    return [sanitizeClinicalCollection(procedures), null];
  } catch (error) {
    console.error("Error al obtener procedimientos:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateProcedureService(query, body, authContext = {}) {
  try {
    const procedure = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const procedureRepository = manager.getRepository(Procedure);
      const procedureFound = await getProcedureWithRelations(
        procedureRepository,
        id,
      );

      if (!procedureFound) {
        throw new Error("Procedimiento no encontrado");
      }

      const nextClinicId = body.clinic_id !== undefined
        ? Number(body.clinic_id)
        : Number(procedureFound.clinic?.id_clinica);
      const clinic = await resolveClinicOrThrow(manager, nextClinicId);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id !== undefined
          ? body.veterinarian_id
          : procedureFound.veterinarian?.id_veterinario ?? null,
      );
      const payload = buildProcedurePayload(body, { current: procedureFound });
      const { animal_id: animalId, ...procedureData } = payload;

      await procedureRepository.save({
        id_procedimiento: Number(procedureFound.id_procedimiento),
        ...procedureData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(procedureFound.user?.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const updatedProcedure = await getProcedureWithRelations(
        procedureRepository,
        procedureFound.id_procedimiento,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        updatedProcedure,
        {
          originType: "PROCEDURE",
          idField: "id_procedimiento",
          eventLabel: "Procedimiento",
          fechaEmisionField: "fecha_procedimiento",
        },
        authContext,
      );
      const refreshedProcedure = await getProcedureWithRelations(
        procedureRepository,
        procedureFound.id_procedimiento,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedProcedure, syncResult),
      );
    });

    return [procedure, null];
  } catch (error) {
    console.error("Error al modificar el procedimiento:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteProcedureService(query) {
  try {
    const procedureDeleted = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const procedureRepository = manager.getRepository(Procedure);
      const procedureFound = await procedureRepository.findOne({
        where: { id_procedimiento: id },
      });

      if (!procedureFound) {
        throw new Error("Procedimiento no encontrado");
      }

      await assertSourceCanBeDeletedFinancially(manager, {
        originType: "PROCEDURE",
        originId: id,
        sourceLabel: "el procedimiento",
      });

      return procedureRepository.remove(procedureFound);
    });

    return [procedureDeleted, null];
  } catch (error) {
    console.error("Error al eliminar el procedimiento:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

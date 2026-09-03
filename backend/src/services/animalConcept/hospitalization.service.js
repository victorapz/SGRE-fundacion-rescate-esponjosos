"use strict";

import Hospitalization from "../../entities/animalConcept/hospitalization.entity.js";
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
  validateHospitalizationDates,
} from "./clinicalRecord.shared.js";

async function getHospitalizationWithRelations(repository, hospitalizationId) {
  return repository.findOne({
    where: { id_hospitalizacion: Number(hospitalizationId) },
    relations: {
      veterinarian: true,
      clinic: true,
      user: true,
      animal: true,
    },
  });
}

function buildHospitalizationPayload(body, context = {}) {
  const payload = {
    fecha_ingreso:
      body.fecha_ingreso !== undefined
        ? normalizeDateInput(body.fecha_ingreso, { required: true })
        : context.current?.fecha_ingreso,
    fecha_alta:
      body.fecha_alta !== undefined
        ? normalizeDateInput(body.fecha_alta)
        : context.current?.fecha_alta ?? null,
    motivo:
      body.motivo !== undefined
        ? normalizeRequiredText(body.motivo)
        : context.current?.motivo,
    diagnostico:
      body.diagnostico !== undefined
        ? normalizeOptionalText(body.diagnostico)
        : context.current?.diagnostico ?? null,
    pronostico:
      body.pronostico !== undefined
        ? normalizeOptionalText(body.pronostico)
        : context.current?.pronostico ?? null,
    peso_ingreso:
      body.peso_ingreso !== undefined
        ? parseLocalizedDecimal(body.peso_ingreso)
        : context.current?.peso_ingreso ?? null,
    temperatura_ingreso:
      body.temperatura_ingreso !== undefined
        ? parseLocalizedDecimal(body.temperatura_ingreso)
        : context.current?.temperatura_ingreso ?? null,
    farmacos_recetados:
      body.farmacos_recetados !== undefined
        ? normalizeOptionalText(body.farmacos_recetados)
        : context.current?.farmacos_recetados ?? null,
    examenes_realizados:
      body.examenes_realizados !== undefined
        ? normalizeOptionalText(body.examenes_realizados)
        : context.current?.examenes_realizados ?? null,
    indicaciones_hospital:
      body.indicaciones_hospital !== undefined
        ? normalizeOptionalText(body.indicaciones_hospital)
        : context.current?.indicaciones_hospital ?? null,
    indicaciones_casa:
      body.indicaciones_casa !== undefined
        ? normalizeOptionalText(body.indicaciones_casa)
        : context.current?.indicaciones_casa ?? null,
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
    fecha_control_post_alta:
      body.fecha_control_post_alta !== undefined
        ? normalizeDateInput(body.fecha_control_post_alta, { required: true })
        : context.current?.fecha_control_post_alta,
    animal_id:
      body.animal_id !== undefined
        ? Number(body.animal_id)
        : Number(context.current?.animal?.id_animal),
  };

  validateHospitalizationDates({
    fechaIngreso: payload.fecha_ingreso,
    fechaAlta: payload.fecha_alta,
    fechaControlPostAlta: payload.fecha_control_post_alta,
  });

  return payload;
}

export async function createHospitalizationService(body, authContext = {}) {
  try {
    const hospitalization = await AppDataSource.transaction(async (manager) => {
      const hospitalizationRepository = manager.getRepository(Hospitalization);
      const clinic = await resolveClinicOrThrow(manager, body.clinic_id);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id,
      );
      const user = await resolveResponsibleUserOrThrow(manager, authContext);
      const payload = buildHospitalizationPayload(body);
      const { animal_id: animalId, ...hospitalizationData } = payload;

      const newHospitalization = hospitalizationRepository.create({
        ...hospitalizationData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(user.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const savedHospitalization = await hospitalizationRepository.save(
        newHospitalization,
      );
      const hospitalizationWithRelations = await getHospitalizationWithRelations(
        hospitalizationRepository,
        savedHospitalization.id_hospitalizacion,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        hospitalizationWithRelations,
        {
          originType: "HOSPITALIZATION",
          idField: "id_hospitalizacion",
          eventLabel: "Hospitalizacion",
          fechaEmisionField: "fecha_ingreso",
        },
        authContext,
      );
      const refreshedHospitalization = await getHospitalizationWithRelations(
        hospitalizationRepository,
        savedHospitalization.id_hospitalizacion,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedHospitalization, syncResult),
      );
    });

    return [hospitalization, null];
  } catch (error) {
    console.error("Error al crear hospitalizacion:", error);
    return [null, error.message || "Error interno al crear hospitalizacion"];
  }
}

export async function getHospitalizationService(query) {
  try {
    const { id } = query;
    const hospitalizationRepository = AppDataSource.getRepository(Hospitalization);
    const hospitalizationFound = await getHospitalizationWithRelations(
      hospitalizationRepository,
      id,
    );

    if (!hospitalizationFound) return [null, "Hospitalizacion no encontrada"];

    return [sanitizeClinicalRecord(hospitalizationFound), null];
  } catch (error) {
    console.error("Error al obtener la hospitalizacion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getHospitalizationsService() {
  try {
    const hospitalizationRepository = AppDataSource.getRepository(Hospitalization);
    const hospitalizations = await hospitalizationRepository.find({
      relations: {
        veterinarian: true,
        clinic: true,
        user: true,
        animal: true,
      },
    });

    if (!hospitalizations || hospitalizations.length === 0) {
      return [null, "No hay hospitalizaciones"];
    }

    return [sanitizeClinicalCollection(hospitalizations), null];
  } catch (error) {
    console.error("Error al obtener hospitalizaciones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateHospitalizationService(query, body, authContext = {}) {
  try {
    const hospitalization = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const hospitalizationRepository = manager.getRepository(Hospitalization);
      const hospitalizationFound = await getHospitalizationWithRelations(
        hospitalizationRepository,
        id,
      );

      if (!hospitalizationFound) {
        throw new Error("Hospitalizacion no encontrada");
      }

      const nextClinicId = body.clinic_id !== undefined
        ? Number(body.clinic_id)
        : Number(hospitalizationFound.clinic?.id_clinica);
      const clinic = await resolveClinicOrThrow(manager, nextClinicId);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id !== undefined
          ? body.veterinarian_id
          : hospitalizationFound.veterinarian?.id_veterinario ?? null,
      );
      const payload = buildHospitalizationPayload(body, { current: hospitalizationFound });
      const { animal_id: animalId, ...hospitalizationData } = payload;

      await hospitalizationRepository.save({
        id_hospitalizacion: Number(hospitalizationFound.id_hospitalizacion),
        ...hospitalizationData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(hospitalizationFound.user?.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const updatedHospitalization = await getHospitalizationWithRelations(
        hospitalizationRepository,
        hospitalizationFound.id_hospitalizacion,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        updatedHospitalization,
        {
          originType: "HOSPITALIZATION",
          idField: "id_hospitalizacion",
          eventLabel: "Hospitalizacion",
          fechaEmisionField: "fecha_ingreso",
        },
        authContext,
      );
      const refreshedHospitalization = await getHospitalizationWithRelations(
        hospitalizationRepository,
        hospitalizationFound.id_hospitalizacion,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedHospitalization, syncResult),
      );
    });

    return [hospitalization, null];
  } catch (error) {
    console.error("Error al modificar la hospitalizacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteHospitalizationService(query) {
  try {
    const hospitalizationDeleted = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const hospitalizationRepository = manager.getRepository(Hospitalization);
      const hospitalizationFound = await hospitalizationRepository.findOne({
        where: { id_hospitalizacion: id },
      });

      if (!hospitalizationFound) {
        throw new Error("Hospitalizacion no encontrada");
      }

      await assertSourceCanBeDeletedFinancially(manager, {
        originType: "HOSPITALIZATION",
        originId: id,
        sourceLabel: "la hospitalizacion",
      });

      return hospitalizationRepository.remove(hospitalizationFound);
    });

    return [hospitalizationDeleted, null];
  } catch (error) {
    console.error("Error al eliminar la hospitalizacion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

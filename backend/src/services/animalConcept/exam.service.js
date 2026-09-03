"use strict";

import Exam from "../../entities/animalConcept/exam.entity.js";
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

async function getExamWithRelations(repository, examId) {
  return repository.findOne({
    where: { id_examen: Number(examId) },
    relations: {
      veterinarian: true,
      clinic: true,
      user: true,
      animal: true,
    },
  });
}

function buildExamPayload(body, context = {}) {
  return {
    fecha_solicitud:
      body.fecha_solicitud !== undefined
        ? normalizeDateInput(body.fecha_solicitud, { required: true })
        : context.current?.fecha_solicitud,
    nombre_examen:
      body.nombre_examen !== undefined
        ? normalizeRequiredText(body.nombre_examen)
        : context.current?.nombre_examen,
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
    fecha_entrega_resultado:
      body.fecha_entrega_resultado !== undefined
        ? normalizeDateInput(body.fecha_entrega_resultado)
        : context.current?.fecha_entrega_resultado ?? null,
    diagnostico:
      body.diagnostico !== undefined
        ? normalizeOptionalText(body.diagnostico)
        : context.current?.diagnostico ?? null,
    indicaciones:
      body.indicaciones !== undefined
        ? normalizeOptionalText(body.indicaciones)
        : context.current?.indicaciones ?? null,
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
    animal_id:
      body.animal_id !== undefined
        ? Number(body.animal_id)
        : Number(context.current?.animal?.id_animal),
  };
}

export async function createExamService(body, authContext = {}) {
  try {
    const exam = await AppDataSource.transaction(async (manager) => {
      const examRepository = manager.getRepository(Exam);
      const clinic = await resolveClinicOrThrow(manager, body.clinic_id);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id,
      );
      const user = await resolveResponsibleUserOrThrow(manager, authContext);
      const payload = buildExamPayload(body);
      const { animal_id: animalId, ...examData } = payload;

      const newExam = examRepository.create({
        ...examData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(user.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const savedExam = await examRepository.save(newExam);
      const examWithRelations = await getExamWithRelations(
        examRepository,
        savedExam.id_examen,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        examWithRelations,
        {
          originType: "EXAM",
          idField: "id_examen",
          eventLabel: "Examen",
          fechaEmisionField: "fecha_solicitud",
        },
        authContext,
      );
      const refreshedExam = await getExamWithRelations(
        examRepository,
        savedExam.id_examen,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedExam, syncResult),
      );
    });

    return [exam, null];
  } catch (error) {
    console.error("Error al crear examen:", error);
    return [null, error.message || "Error interno al crear examen"];
  }
}

export async function getExamService(query) {
  try {
    const { id } = query;
    const examRepository = AppDataSource.getRepository(Exam);
    const examFound = await getExamWithRelations(examRepository, id);

    if (!examFound) return [null, "Examen no encontrado"];

    return [sanitizeClinicalRecord(examFound), null];
  } catch (error) {
    console.error("Error al obtener el examen:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getExamsService() {
  try {
    const examRepository = AppDataSource.getRepository(Exam);
    const exams = await examRepository.find({
      relations: {
        veterinarian: true,
        clinic: true,
        user: true,
        animal: true,
      },
    });

    if (!exams || exams.length === 0) return [null, "No hay examenes"];

    return [sanitizeClinicalCollection(exams), null];
  } catch (error) {
    console.error("Error al obtener examenes:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateExamService(query, body, authContext = {}) {
  try {
    const exam = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const examRepository = manager.getRepository(Exam);
      const examFound = await getExamWithRelations(examRepository, id);

      if (!examFound) {
        throw new Error("Examen no encontrado");
      }

      const nextClinicId = body.clinic_id !== undefined
        ? Number(body.clinic_id)
        : Number(examFound.clinic?.id_clinica);
      const clinic = await resolveClinicOrThrow(manager, nextClinicId);
      const veterinarian = await resolveVeterinarianForClinic(
        manager,
        clinic.id_clinica,
        body.veterinarian_id !== undefined
          ? body.veterinarian_id
          : examFound.veterinarian?.id_veterinario ?? null,
      );
      const payload = buildExamPayload(body, { current: examFound });
      const { animal_id: animalId, ...examData } = payload;

      await examRepository.save({
        id_examen: Number(examFound.id_examen),
        ...examData,
        clinic: { id_clinica: Number(clinic.id_clinica) },
        veterinarian: veterinarian
          ? { id_veterinario: Number(veterinarian.id_veterinario) }
          : null,
        user: { id_usuario: Number(examFound.user?.id_usuario) },
        animal: { id_animal: Number(animalId) },
      });

      const updatedExam = await getExamWithRelations(
        examRepository,
        examFound.id_examen,
      );
      const syncResult = await syncClinicalPayable(
        manager,
        updatedExam,
        {
          originType: "EXAM",
          idField: "id_examen",
          eventLabel: "Examen",
          fechaEmisionField: "fecha_solicitud",
        },
        authContext,
      );
      const refreshedExam = await getExamWithRelations(
        examRepository,
        examFound.id_examen,
      );

      return sanitizeClinicalRecord(
        attachClinicalPayableSummary(refreshedExam, syncResult),
      );
    });

    return [exam, null];
  } catch (error) {
    console.error("Error al modificar el examen:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function deleteExamService(query) {
  try {
    const examDeleted = await AppDataSource.transaction(async (manager) => {
      const { id } = query;
      const examRepository = manager.getRepository(Exam);
      const examFound = await examRepository.findOne({
        where: { id_examen: id },
      });

      if (!examFound) {
        throw new Error("Examen no encontrado");
      }

      await assertSourceCanBeDeletedFinancially(manager, {
        originType: "EXAM",
        originId: id,
        sourceLabel: "el examen",
      });

      return examRepository.remove(examFound);
    });

    return [examDeleted, null];
  } catch (error) {
    console.error("Error al eliminar el examen:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

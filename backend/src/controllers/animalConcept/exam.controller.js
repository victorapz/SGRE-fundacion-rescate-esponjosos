"use strict";

import {
  examCreateValidation,
  examQueryValidation,
  examUpdateBodyValidation,
} from "../../validations/exam.validation.js";

import {
  createExamService,
  deleteExamService,
  getExamsService,
  getExamService,
  updateExamService,
} from "../../services/animalConcept/exam.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

function buildAuthContext(req) {
  return {
    userId: req.user?.id_usuario,
    permissions: req.permissions || [],
  };
}

export async function createExam(req, res) {
  try {
    const { body } = req;

    const { error } = examCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [exam, errorExam] = await createExamService(body, buildAuthContext(req));

    if (errorExam) return handleErrorClient(res, 400, errorExam);

    handleSuccess(res, 201, "Examen creado correctamente", exam);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getExam(req, res) {
  try {
    const { id } = req.query;

    const { error } = examQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [exam, errorExam] = await getExamService({ id });

    if (errorExam) return handleErrorClient(res, 404, errorExam);

    handleSuccess(res, 200, "Examen encontrado", exam);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getExams(req, res) {
  try {
    const [exams, errorExams] = await getExamsService();

    if (errorExams) return handleErrorClient(res, 404, errorExams);

    exams.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Examenes encontrados", exams);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateExam(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = examQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = examUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [exam, examError] = await updateExamService({ id }, body, buildAuthContext(req));

    if (examError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el examen",
        examError,
      );

    handleSuccess(res, 200, "Examen modificado correctamente", exam);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteExam(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = examQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [examDelete, errorExamDelete] = await deleteExamService({ id });

    if (errorExamDelete)
      {
        const statusCode = errorExamDelete === "Examen no encontrado" ? 404 : 400;
      return handleErrorClient(
        res,
        statusCode,
        "Error eliminando el examen",
        errorExamDelete,
      );
      }

    handleSuccess(res, 200, "Examen eliminado correctamente", examDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

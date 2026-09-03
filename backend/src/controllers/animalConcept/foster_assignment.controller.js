"use strict";

import {
  fosterAssignmentCreateValidation,
  fosterAssignmentListQueryValidation,
  fosterAssignmentQueryValidation,
  fosterAssignmentUpdateBodyValidation,
} from "../../validations/foster_assignment.validation.js";

import {
  createFosterAssignmentService,
  deleteFosterAssignmentService,
  getFosterAssignmentsService,
  getFosterAssignmentService,
  updateFosterAssignmentService,
} from "../../services/animalConcept/foster_assignment.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createFosterAssignment(req, res) {
  try {
    const { body } = req;

    const { error } = fosterAssignmentCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [assignment, errorAssignment] = await createFosterAssignmentService(body);

    if (errorAssignment) return handleErrorClient(res, 400, errorAssignment);

    handleSuccess(res, 201, "Asignacion creada correctamente", assignment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterAssignment(req, res) {
  try {
    const { id } = req.query;

    const { error } = fosterAssignmentQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [assignment, errorAssignment] = await getFosterAssignmentService({ id });

    if (errorAssignment) return handleErrorClient(res, 404, errorAssignment);

    handleSuccess(res, 200, "Asignacion encontrada", assignment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterAssignments(req, res) {
  try {
    const { error } = fosterAssignmentListQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [assignments, errorAssignments] = await getFosterAssignmentsService(req.query);

    if (errorAssignments) return handleErrorClient(res, 404, errorAssignments);

    assignments.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Asignaciones encontradas", assignments);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateFosterAssignment(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = fosterAssignmentQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = fosterAssignmentUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [assignment, assignmentError] = await updateFosterAssignmentService(
      { id },
      body,
    );

    if (assignmentError)
      return handleErrorClient(
        res,
        400,
        "Error modificando la asignacion",
        assignmentError,
      );

    handleSuccess(res, 200, "Asignacion modificada correctamente", assignment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteFosterAssignment(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = fosterAssignmentQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [assignmentDelete, errorAssignmentDelete] =
      await deleteFosterAssignmentService({ id });

    if (errorAssignmentDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando la asignacion",
        errorAssignmentDelete,
      );

    handleSuccess(res, 200, "Asignacion eliminada correctamente", assignmentDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  procedureCreateValidation,
  procedureQueryValidation,
  procedureUpdateBodyValidation,
} from "../../validations/procedure.validation.js";

import {
  createProcedureService,
  deleteProcedureService,
  getProceduresService,
  getProcedureService,
  updateProcedureService,
} from "../../services/animalConcept/procedure.service.js";

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

export async function createProcedure(req, res) {
  try {
    const { body } = req;

    const { error } = procedureCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [procedure, errorProcedure] = await createProcedureService(
      body,
      buildAuthContext(req),
    );

    if (errorProcedure) return handleErrorClient(res, 400, errorProcedure);

    handleSuccess(res, 201, "Procedimiento creado correctamente", procedure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getProcedure(req, res) {
  try {
    const { id } = req.query;

    const { error } = procedureQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [procedure, errorProcedure] = await getProcedureService({ id });

    if (errorProcedure) return handleErrorClient(res, 404, errorProcedure);

    handleSuccess(res, 200, "Procedimiento encontrado", procedure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getProcedures(req, res) {
  try {
    const [procedures, errorProcedures] = await getProceduresService();

    if (errorProcedures) return handleErrorClient(res, 404, errorProcedures);

    procedures.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Procedimientos encontrados", procedures);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateProcedure(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = procedureQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = procedureUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [procedure, procedureError] = await updateProcedureService(
      { id },
      body,
      buildAuthContext(req),
    );

    if (procedureError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el procedimiento",
        procedureError,
      );

    handleSuccess(res, 200, "Procedimiento modificado correctamente", procedure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteProcedure(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = procedureQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [procedureDelete, errorProcedureDelete] = await deleteProcedureService({ id });

    if (errorProcedureDelete)
      {
        const statusCode = errorProcedureDelete === "Procedimiento no encontrado"
          ? 404
          : 400;
      return handleErrorClient(
        res,
        statusCode,
        "Error eliminando el procedimiento",
        errorProcedureDelete,
      );
      }

    handleSuccess(res, 200, "Procedimiento eliminado correctamente", procedureDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

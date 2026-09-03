"use strict";

import {
  vetCheckupCreateValidation,
  vetCheckupQueryValidation,
  vetCheckupUpdateBodyValidation,
} from "../../validations/vet_checkup.validation.js";

import {
  createVetCheckupService,
  deleteVetCheckupService,
  getVetCheckupsService,
  getVetCheckupService,
  updateVetCheckupService,
} from "../../services/animalConcept/vet_checkup.service.js";

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

export async function createVetCheckup(req, res) {
  try {
    const { body } = req;

    const { error } = vetCheckupCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [checkup, errorCheckup] = await createVetCheckupService(
      body,
      buildAuthContext(req),
    );

    if (errorCheckup) return handleErrorClient(res, 400, errorCheckup);

    handleSuccess(res, 201, "Control creado correctamente", checkup);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVetCheckup(req, res) {
  try {
    const { id } = req.query;

    const { error } = vetCheckupQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [checkup, errorCheckup] = await getVetCheckupService({ id });

    if (errorCheckup) return handleErrorClient(res, 404, errorCheckup);

    handleSuccess(res, 200, "Control encontrado", checkup);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVetCheckups(req, res) {
  try {
    const [checkups, errorCheckups] = await getVetCheckupsService();

    if (errorCheckups) return handleErrorClient(res, 404, errorCheckups);

    checkups.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Controles encontrados", checkups);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateVetCheckup(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = vetCheckupQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = vetCheckupUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [checkup, checkupError] = await updateVetCheckupService(
      { id },
      body,
      buildAuthContext(req),
    );

    if (checkupError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el control",
        checkupError,
      );

    handleSuccess(res, 200, "Control modificado correctamente", checkup);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteVetCheckup(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = vetCheckupQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [checkupDelete, errorCheckupDelete] =
      await deleteVetCheckupService({ id });

    if (errorCheckupDelete)
      {
        const statusCode = errorCheckupDelete === "Control no encontrado" ? 404 : 400;
      return handleErrorClient(
        res,
        statusCode,
        "Error eliminando el control",
        errorCheckupDelete,
      );
      }

    handleSuccess(res, 200, "Control eliminado correctamente", checkupDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

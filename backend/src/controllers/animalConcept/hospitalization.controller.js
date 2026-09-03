"use strict";

import {
  hospitalizationCreateValidation,
  hospitalizationQueryValidation,
  hospitalizationUpdateBodyValidation,
} from "../../validations/hospitalization.validation.js";

import {
  createHospitalizationService,
  deleteHospitalizationService,
  getHospitalizationsService,
  getHospitalizationService,
  updateHospitalizationService,
} from "../../services/animalConcept/hospitalization.service.js";

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

export async function createHospitalization(req, res) {
  try {
    const { body } = req;

    const { error } = hospitalizationCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [hospitalization, errorHospitalization] =
      await createHospitalizationService(body, buildAuthContext(req));

    if (errorHospitalization)
      return handleErrorClient(res, 400, errorHospitalization);

    handleSuccess(
      res,
      201,
      "Hospitalizacion creada correctamente",
      hospitalization,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getHospitalization(req, res) {
  try {
    const { id } = req.query;

    const { error } = hospitalizationQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [hospitalization, errorHospitalization] =
      await getHospitalizationService({ id });

    if (errorHospitalization)
      return handleErrorClient(res, 404, errorHospitalization);

    handleSuccess(res, 200, "Hospitalizacion encontrada", hospitalization);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getHospitalizations(req, res) {
  try {
    const [hospitalizations, errorHospitalizations] =
      await getHospitalizationsService();

    if (errorHospitalizations)
      return handleErrorClient(res, 404, errorHospitalizations);

    hospitalizations.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Hospitalizaciones encontradas", hospitalizations);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateHospitalization(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = hospitalizationQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = hospitalizationUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [hospitalization, hospitalizationError] =
      await updateHospitalizationService({ id }, body, buildAuthContext(req));

    if (hospitalizationError)
      return handleErrorClient(
        res,
        400,
        "Error modificando la hospitalizacion",
        hospitalizationError,
      );

    handleSuccess(
      res,
      200,
      "Hospitalizacion modificada correctamente",
      hospitalization,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteHospitalization(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = hospitalizationQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [hospitalizationDelete, errorHospitalizationDelete] =
      await deleteHospitalizationService({ id });

    if (errorHospitalizationDelete)
      {
        const statusCode = errorHospitalizationDelete === "Hospitalizacion no encontrada"
          ? 404
          : 400;
      return handleErrorClient(
        res,
        statusCode,
        "Error eliminando la hospitalizacion",
        errorHospitalizationDelete,
      );
      }

    handleSuccess(
      res,
      200,
      "Hospitalizacion eliminada correctamente",
      hospitalizationDelete,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

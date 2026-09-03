"use strict";

import {
  fosterHomeObservationCreateValidation,
  fosterHomeObservationListQueryValidation,
  fosterHomeObservationQueryValidation,
} from "../../validations/foster_home_observation.validation.js";
import {
  createFosterHomeObservationService,
  deleteFosterHomeObservationService,
  getFosterHomeObservationsService,
} from "../../services/animalConcept/foster_home_observation.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createFosterHomeObservation(req, res) {
  try {
    const { body } = req;
    const { error } = fosterHomeObservationCreateValidation.validate(body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [observation, observationError] = await createFosterHomeObservationService(body);
    if (observationError) return handleErrorClient(res, 400, observationError);

    return handleSuccess(res, 201, "Observacion creada correctamente", observation);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getFosterHomeObservations(req, res) {
  try {
    const { foster_home_id } = req.query;
    const { error } = fosterHomeObservationListQueryValidation.validate({ foster_home_id });

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [observations, observationsError] = await getFosterHomeObservationsService({
      foster_home_id,
    });

    if (observationsError) return handleErrorClient(res, 404, observationsError);

    return observations.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Observaciones encontradas", observations);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteFosterHomeObservation(req, res) {
  try {
    const { id } = req.query;
    const { error } = fosterHomeObservationQueryValidation.validate({ id });

    if (error) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        error.message,
      );
    }

    const [observation, observationError] = await deleteFosterHomeObservationService({ id });
    if (observationError) {
      return handleErrorClient(
        res,
        404,
        "Error eliminando la observacion",
        observationError,
      );
    }

    return handleSuccess(res, 200, "Observacion eliminada correctamente", observation);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

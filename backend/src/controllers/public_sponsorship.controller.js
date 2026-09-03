"use strict";

import {
  publicSponsorshipIdempotencyKeyValidation,
  publicSponsorshipAnimalIdValidation,
  publicSponsorshipAnimalListValidation,
  publicSponsorshipStartValidation,
  sponsorshipPublicReferenceValidation,
} from "../validations/sponsorship.validation.js";
import {
  getPublicSponsorshipAnimalDetailService,
  getPublicSponsorshipAnimalsService,
  getPublicSponsorshipPlansService,
} from "../services/publicSponsorship.service.js";
import {
  getPublicSponsorshipStatusService,
  startPublicSponsorshipService,
} from "../services/financialConcept/sponsorshipSubscription.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

function getErrorStatusCode(errorPayload, fallbackStatusCode) {
  return Number(errorPayload?.statusCode) || fallbackStatusCode;
}

function getErrorMessage(errorPayload, fallbackMessage) {
  return errorPayload?.message || fallbackMessage;
}

function handleControllerError(res, errorPayload, fallbackStatusCode, fallbackMessage) {
  const statusCode = getErrorStatusCode(errorPayload, fallbackStatusCode);
  const message = getErrorMessage(errorPayload, fallbackMessage);

  if (statusCode >= 500) {
    return handleErrorServer(res, statusCode, message);
  }

  return handleErrorClient(res, statusCode, message);
}

export async function getPublicSponsorshipPlans(req, res) {
  try {
    const [plans, serviceError] = await getPublicSponsorshipPlansService();
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Planes publicos de apadrinamiento encontrados", plans);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicSponsorshipAnimals(req, res) {
  try {
    const { error, value } = publicSponsorshipAnimalListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [animals, serviceError] = await getPublicSponsorshipAnimalsService(value);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Animales publicos apadrinables encontrados", animals);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicSponsorshipAnimalDetail(req, res) {
  try {
    const { error } = publicSponsorshipAnimalIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [animal, serviceError] = await getPublicSponsorshipAnimalDetailService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Animal apadrinable encontrado", animal);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function startPublicSponsorship(req, res) {
  try {
    const { error: bodyError, value } = publicSponsorshipStartValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const { error: keyError, value: headerValue } = publicSponsorshipIdempotencyKeyValidation.validate({
      idempotencyKey: req.get("Idempotency-Key"),
    });
    if (keyError) return handleErrorClient(res, 400, "Error de validacion", keyError.message);

    const [payload, serviceError] = await startPublicSponsorshipService(value, {
      idempotencyKey: headerValue.idempotencyKey,
    });
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible iniciar el apadrinamiento.",
      );
    }

    return handleSuccess(res, 201, "Apadrinamiento iniciado correctamente", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicSponsorshipStatus(req, res) {
  try {
    const { error } = sponsorshipPublicReferenceValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [payload, serviceError] = await getPublicSponsorshipStatusService(req.params);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        404,
        "No fue posible obtener el estado del apadrinamiento.",
      );
    }

    return handleSuccess(res, 200, "Estado publico de apadrinamiento encontrado", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

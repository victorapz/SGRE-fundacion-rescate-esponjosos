"use strict";

import {
  sponsorshipPlanCreateValidation,
  sponsorshipPlanIdValidation,
  sponsorshipPlanListValidation,
  sponsorshipPlanProvisionValidation,
  sponsorshipPlanUpdateValidation,
} from "../../validations/sponsorship.validation.js";
import {
  createSponsorshipPlanService,
  deleteSponsorshipPlanService,
  getSponsorshipPlanService,
  getSponsorshipPlansService,
  updateSponsorshipPlanService,
} from "../../services/financialConcept/sponsorshipPlan.service.js";
import { provisionSponsorshipPlanPayPalService } from "../../services/financialConcept/sponsorshipSubscription.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

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

export async function createSponsorshipPlan(req, res) {
  try {
    const { error } = sponsorshipPlanCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [plan, serviceError] = await createSponsorshipPlanService(req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 201, "Plan de apadrinamiento creado correctamente", plan);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsorshipPlans(req, res) {
  try {
    const { error } = sponsorshipPlanListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [plans, serviceError] = await getSponsorshipPlansService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Planes de apadrinamiento encontrados", plans);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsorshipPlan(req, res) {
  try {
    const { error } = sponsorshipPlanIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [plan, serviceError] = await getSponsorshipPlanService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Plan de apadrinamiento encontrado", plan);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateSponsorshipPlan(req, res) {
  try {
    const { error: idError } = sponsorshipPlanIdValidation.validate(req.params);
    if (idError) return handleErrorClient(res, 400, "Error de validacion", idError.message);

    const { error: bodyError } = sponsorshipPlanUpdateValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const [plan, serviceError] = await updateSponsorshipPlanService(req.params, req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Plan de apadrinamiento actualizado correctamente", plan);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteSponsorshipPlan(req, res) {
  try {
    const { error } = sponsorshipPlanIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [plan, serviceError] = await deleteSponsorshipPlanService(req.params);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(
      res,
      200,
      plan
        ? "Plan de apadrinamiento desactivado correctamente"
        : "Plan de apadrinamiento eliminado correctamente",
      plan,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function provisionSponsorshipPlanPayPal(req, res) {
  try {
    const { error } = sponsorshipPlanProvisionValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [plan, serviceError] = await provisionSponsorshipPlanPayPalService(req.params);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible aprovisionar el plan PayPal.",
      );
    }

    return handleSuccess(res, 200, "Plan PayPal aprovisionado correctamente", plan);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

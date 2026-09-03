"use strict";

import {
  adminSponsorshipIdempotencyKeyValidation,
  sponsorCreateValidation,
  sponsorIdValidation,
  sponsorListValidation,
  sponsorUpdateValidation,
  sponsorshipAnimalIdValidation,
  sponsorshipAnimalListValidation,
  sponsorshipAnimalUpdateValidation,
  sponsorshipIdValidation,
  sponsorshipListValidation,
  sponsorshipManualCreateValidation,
  subscriptionIdValidation,
  subscriptionCancelBodyValidation,
  subscriptionListValidation,
  subscriptionPaymentManualCreateValidation,
  subscriptionSyncValidation,
  subscriptionPaymentIdValidation,
  subscriptionPaymentListValidation,
} from "../../validations/sponsorship.validation.js";
import {
  createManualSponsorshipService,
  getSponsorshipAnimalsService,
  getSponsorshipService,
  getSponsorshipsService,
  getSubscriptionPaymentService,
  getSubscriptionPaymentsService,
  getSubscriptionService,
  getSubscriptionsService,
  updateSponsorshipAnimalService,
} from "../../services/financialConcept/sponsorshipAdmin.service.js";
import {
  createSponsorService,
  getSponsorService,
  getSponsorsService,
  updateSponsorService,
} from "../../services/financialConcept/sponsor.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";
import {
  cancelSubscriptionService,
  createManualSubscriptionPaymentService,
  syncSubscriptionService,
} from "../../services/financialConcept/sponsorshipSubscription.service.js";

function buildAuthContext(req) {
  return {
    userId: req.user?.id_usuario,
    user: req.user || null,
    permissions: req.permissions || [],
  };
}

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

export async function getSponsorshipAnimals(req, res) {
  try {
    const { error } = sponsorshipAnimalListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [animals, serviceError] = await getSponsorshipAnimalsService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Animales apadrinables encontrados", animals);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateSponsorshipAnimal(req, res) {
  try {
    const { error: idError } = sponsorshipAnimalIdValidation.validate(req.params);
    if (idError) return handleErrorClient(res, 400, "Error de validacion", idError.message);

    const { error: bodyError } = sponsorshipAnimalUpdateValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const [animal, serviceError] = await updateSponsorshipAnimalService(req.params, req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Animal apadrinable actualizado correctamente", animal);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsors(req, res) {
  try {
    const { error } = sponsorListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [sponsors, serviceError] = await getSponsorsService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Padrinos encontrados", sponsors);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createSponsor(req, res) {
  try {
    const { error } = sponsorCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [sponsor, serviceError] = await createSponsorService(req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 201, "Padrino creado correctamente", sponsor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsor(req, res) {
  try {
    const { error } = sponsorIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [sponsor, serviceError] = await getSponsorService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Padrino encontrado", sponsor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateSponsor(req, res) {
  try {
    const { error: idError } = sponsorIdValidation.validate(req.params);
    if (idError) return handleErrorClient(res, 400, "Error de validacion", idError.message);

    const { error: bodyError } = sponsorUpdateValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const [sponsor, serviceError] = await updateSponsorService(req.params, req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Padrino actualizado correctamente", sponsor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsorships(req, res) {
  try {
    const { error } = sponsorshipListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [items, serviceError] = await getSponsorshipsService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Apadrinamientos encontrados", items);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createManualSponsorship(req, res) {
  try {
    const { error } = sponsorshipManualCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [item, serviceError] = await createManualSponsorshipService(req.body);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 201, "Apadrinamiento manual creado correctamente", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSponsorship(req, res) {
  try {
    const { error } = sponsorshipIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [item, serviceError] = await getSponsorshipService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Apadrinamiento encontrado", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSubscriptions(req, res) {
  try {
    const { error } = subscriptionListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [items, serviceError] = await getSubscriptionsService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Suscripciones encontradas", items);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSubscription(req, res) {
  try {
    const { error } = subscriptionIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [item, serviceError] = await getSubscriptionService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Suscripcion encontrada", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSubscriptionPayments(req, res) {
  try {
    const { error } = subscriptionPaymentListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [items, serviceError] = await getSubscriptionPaymentsService(req.query);
    if (serviceError) return handleErrorClient(res, 400, serviceError);

    return handleSuccess(res, 200, "Pagos recurrentes encontrados", items);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createManualSubscriptionPayment(req, res) {
  try {
    const { error: bodyError } = subscriptionPaymentManualCreateValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const { error: headerError } = adminSponsorshipIdempotencyKeyValidation.validate({
      idempotencyKey: req.headers["idempotency-key"],
    });
    if (headerError) return handleErrorClient(res, 400, "Error de validacion", headerError.message);

    const [item, serviceError] = await createManualSubscriptionPaymentService(
      req.body,
      {
        idempotencyKey: req.headers["idempotency-key"],
        authContext: buildAuthContext(req),
      },
    );
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible registrar el pago manual.",
      );
    }

    return handleSuccess(res, 201, "Pago manual registrado correctamente", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSubscriptionPayment(req, res) {
  try {
    const { error } = subscriptionPaymentIdValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [item, serviceError] = await getSubscriptionPaymentService(req.params);
    if (serviceError) return handleErrorClient(res, 404, serviceError);

    return handleSuccess(res, 200, "Pago recurrente encontrado", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function syncSubscription(req, res) {
  try {
    const { error } = subscriptionSyncValidation.validate(req.params);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [item, serviceError] = await syncSubscriptionService(req.params);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible sincronizar la suscripcion.",
      );
    }

    return handleSuccess(res, 200, "Suscripcion sincronizada correctamente", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function cancelSubscription(req, res) {
  try {
    const { error: idError } = subscriptionIdValidation.validate(req.params);
    if (idError) return handleErrorClient(res, 400, "Error de validacion", idError.message);

    const { error: bodyError } = subscriptionCancelBodyValidation.validate(req.body);
    if (bodyError) return handleErrorClient(res, 400, "Error de validacion", bodyError.message);

    const [item, serviceError] = await cancelSubscriptionService(req.params, req.body);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible cancelar la suscripcion.",
      );
    }

    return handleSuccess(res, 200, "Suscripcion cancelada correctamente", item);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

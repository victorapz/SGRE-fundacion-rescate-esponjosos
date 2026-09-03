"use strict";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";
import { processPayPalWebhookService } from "../../services/paypal/paypalWebhook.service.js";

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

export async function receivePayPalWebhook(req, res) {
  try {
    const [result, serviceError] = await processPayPalWebhookService({
      headers: req.headers,
      rawBody: req.rawBody,
      webhookEvent: req.body,
    });

    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible procesar el webhook PayPal.",
      );
    }

    return handleSuccess(res, 200, "Webhook PayPal recibido correctamente", result);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

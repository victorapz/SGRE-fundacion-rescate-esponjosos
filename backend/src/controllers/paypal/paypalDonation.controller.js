"use strict";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";
import {
  capturePayPalDonationOrderService,
  createPayPalDonationOrderService,
} from "../../services/paypal/paypalDonation.service.js";
import {
  paypalDonationCaptureOrderValidation,
  paypalDonationCreateOrderValidation,
} from "../../validations/paypal/paypalDonation.validation.js";

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

export async function createPayPalDonationOrder(req, res) {
  try {
    const { error, value } = paypalDonationCreateOrderValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [order, serviceError] = await createPayPalDonationOrderService(value);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible crear la orden PayPal.",
      );
    }

    return handleSuccess(res, 201, "Orden PayPal creada correctamente", order);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function capturePayPalDonationOrder(req, res) {
  try {
    const { error, value } = paypalDonationCaptureOrderValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, serviceError] = await capturePayPalDonationOrderService(value);
    if (serviceError) {
      return handleControllerError(
        res,
        serviceError,
        400,
        "No fue posible capturar la orden PayPal.",
      );
    }

    return handleSuccess(res, 200, "Orden PayPal capturada correctamente", result);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  accountingDonationListValidation,
  accountingDonationRefundBodyValidation,
  accountingDonationRefundParamsValidation,
} from "../../validations/accounting_donation.validation.js";
import { getAccountingDonationsService } from "../../services/financialConcept/accountingDonation.service.js";
import { createAdminPayPalDonationRefundService } from "../../services/paypal/paypalDonation.service.js";
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

function handleControllerError(res, errorPayload, fallbackStatusCode, fallbackMessage) {
  const statusCode = Number(errorPayload?.statusCode) || fallbackStatusCode;
  const message = errorPayload?.message || fallbackMessage;

  if (statusCode >= 500) {
    return handleErrorServer(res, statusCode, message);
  }

  return handleErrorClient(res, statusCode, message);
}

export async function getAccountingDonations(req, res) {
  try {
    const { error } = accountingDonationListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donations, donationsError] = await getAccountingDonationsService(req.query);
    if (donationsError) return handleErrorClient(res, 400, donationsError);

    return handleSuccess(res, 200, "Donaciones monetarias encontradas", donations);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createAccountingDonationRefund(req, res) {
  try {
    const { error: paramsError, value: paramsValue } =
      accountingDonationRefundParamsValidation.validate(req.params);
    if (paramsError) {
      return handleErrorClient(res, 400, "Error de validacion", paramsError.message);
    }

    const { error: bodyError, value: bodyValue } =
      accountingDonationRefundBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion", bodyError.message);
    }

    const [refundResult, refundError] = await createAdminPayPalDonationRefundService({
      paymentOrderId: paramsValue.paymentOrderId,
      amount: bodyValue.monto,
      reason: bodyValue.motivo,
      authContext: buildAuthContext(req),
    });

    if (refundError) {
      return handleControllerError(
        res,
        refundError,
        400,
        "No fue posible crear el refund PayPal.",
      );
    }

    return handleSuccess(res, 201, "Refund PayPal creado correctamente", refundResult);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

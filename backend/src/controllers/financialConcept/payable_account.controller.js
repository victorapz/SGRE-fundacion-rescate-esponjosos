"use strict";

import {
  payableAccountCancelBodyValidation,
  payableAccountCreateValidation,
  payableAccountListValidation,
  payableAccountQueryValidation,
  payableAccountUpdateBodyValidation,
} from "../../validations/payable_account.validation.js";
import {
  payablePaymentCreateValidation,
  payablePaymentParamsValidation,
} from "../../validations/payable_payment.validation.js";
import {
  cancelPayableAccountService,
  createPayableAccountService,
  getPayableAccountService,
  getPayableAccountsService,
  updatePayableAccountService,
} from "../../services/financialConcept/payableAccount.service.js";
import { createPayablePaymentService } from "../../services/financialConcept/payablePayment.service.js";
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

export async function createPayableAccount(req, res) {
  try {
    const { error } = payableAccountCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [payable, payableError] = await createPayableAccountService(
      req.body,
      buildAuthContext(req),
    );
    if (payableError) return handleErrorClient(res, 400, payableError);

    return handleSuccess(res, 201, "Cuenta por pagar creada correctamente", payable);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPayableAccount(req, res) {
  try {
    const { error } = payableAccountQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [payable, payableError] = await getPayableAccountService(req.query);
    if (payableError) return handleErrorClient(res, 404, payableError);

    return handleSuccess(res, 200, "Cuenta por pagar encontrada", payable);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPayableAccounts(req, res) {
  try {
    const { error } = payableAccountListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [payables, payableError] = await getPayableAccountsService(req.query);
    if (payableError) return handleErrorClient(res, 400, payableError);

    return handleSuccess(res, 200, "Cuentas por pagar encontradas", payables);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updatePayableAccount(req, res) {
  try {
    const { error: queryError } = payableAccountQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = payableAccountUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [payable, payableError] = await updatePayableAccountService(req.query, req.body);
    if (payableError) return handleErrorClient(res, 400, payableError);

    return handleSuccess(res, 200, "Cuenta por pagar actualizada correctamente", payable);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function cancelPayableAccount(req, res) {
  try {
    const { error: queryError } = payableAccountQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = payableAccountCancelBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [payable, payableError] = await cancelPayableAccountService(req.query, req.body);
    if (payableError) return handleErrorClient(res, 400, payableError);

    return handleSuccess(res, 200, "Cuenta por pagar cerrada correctamente", payable);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function createPayablePayment(req, res) {
  try {
    const { error: paramsError } = payablePaymentParamsValidation.validate(req.params);
    if (paramsError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la ruta",
        paramsError.message,
      );
    }

    const { error: bodyError } = payablePaymentCreateValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [payment, paymentError] = await createPayablePaymentService(
      { cuenta_por_pagar_id: req.params.cuenta_por_pagar_id },
      req.body,
      buildAuthContext(req),
    );
    if (paymentError) return handleErrorClient(res, 400, paymentError);

    return handleSuccess(res, 201, "Pago de cuenta por pagar registrado correctamente", payment);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

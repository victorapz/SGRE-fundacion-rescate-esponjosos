"use strict";

import {
  paymentOrderCancelBodyValidation,
  paymentOrderCreateValidation,
  paymentOrderListValidation,
  paymentOrderQueryValidation,
  paymentOrderUpdateBodyValidation,
} from "../../validations/payment_order.validation.js";
import {
  cancelPaymentOrderService,
  createPaymentOrderService,
  getPaymentOrderService,
  getPaymentOrdersService,
  updatePaymentOrderService,
} from "../../services/financialConcept/paymentOrder.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createPaymentOrder(req, res) {
  try {
    const { error } = paymentOrderCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [order, orderError] = await createPaymentOrderService(req.body);
    if (orderError) return handleErrorClient(res, 400, orderError);

    return handleSuccess(res, 201, "Orden de pago creada correctamente", order);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPaymentOrder(req, res) {
  try {
    const { error } = paymentOrderQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [order, orderError] = await getPaymentOrderService(req.query);
    if (orderError) return handleErrorClient(res, 404, orderError);

    return handleSuccess(res, 200, "Orden de pago encontrada", order);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPaymentOrders(req, res) {
  try {
    const { error } = paymentOrderListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [orders, orderError] = await getPaymentOrdersService(req.query);
    if (orderError) return handleErrorClient(res, 400, orderError);

    return handleSuccess(res, 200, "Ordenes de pago encontradas", orders);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updatePaymentOrder(req, res) {
  try {
    const { error: queryError } = paymentOrderQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = paymentOrderUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [order, orderError] = await updatePaymentOrderService(req.query, req.body);
    if (orderError) return handleErrorClient(res, 400, orderError);

    return handleSuccess(res, 200, "Orden de pago actualizada correctamente", order);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function cancelPaymentOrder(req, res) {
  try {
    const { error: queryError } = paymentOrderQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = paymentOrderCancelBodyValidation.validate(req.body || {});
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [order, orderError] = await cancelPaymentOrderService(req.query, req.body);
    if (orderError) return handleErrorClient(res, 400, orderError);

    return handleSuccess(res, 200, "Orden de pago cancelada correctamente", order);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

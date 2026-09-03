"use strict";

import {
  paymentProviderCreateValidation,
  paymentProviderListValidation,
  paymentProviderQueryValidation,
  paymentProviderUpdateBodyValidation,
} from "../../validations/payment_provider.validation.js";
import {
  createPaymentProviderService,
  deletePaymentProviderService,
  getPaymentProviderService,
  getPaymentProvidersService,
  updatePaymentProviderService,
} from "../../services/financialConcept/paymentProvider.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createPaymentProvider(req, res) {
  try {
    const { error } = paymentProviderCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [provider, providerError] = await createPaymentProviderService(req.body);
    if (providerError) return handleErrorClient(res, 400, providerError);

    return handleSuccess(res, 201, "Proveedor de pago creado correctamente", provider);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPaymentProvider(req, res) {
  try {
    const { error } = paymentProviderQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [provider, providerError] = await getPaymentProviderService(req.query);
    if (providerError) return handleErrorClient(res, 404, providerError);

    return handleSuccess(res, 200, "Proveedor de pago encontrado", provider);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPaymentProviders(req, res) {
  try {
    const { error } = paymentProviderListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [providers, providerError] = await getPaymentProvidersService(req.query);
    if (providerError) return handleErrorClient(res, 400, providerError);

    return handleSuccess(res, 200, "Proveedores de pago encontrados", providers);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updatePaymentProvider(req, res) {
  try {
    const { error: queryError } = paymentProviderQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = paymentProviderUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [provider, providerError] = await updatePaymentProviderService(req.query, req.body);
    if (providerError) return handleErrorClient(res, 400, providerError);

    return handleSuccess(res, 200, "Proveedor de pago actualizado correctamente", provider);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deletePaymentProvider(req, res) {
  try {
    const { error } = paymentProviderQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [provider, providerError] = await deletePaymentProviderService(req.query);
    if (providerError) return handleErrorClient(res, 400, providerError);

    return handleSuccess(res, 200, "Proveedor de pago desactivado correctamente", provider);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

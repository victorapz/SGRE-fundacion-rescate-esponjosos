"use strict";

import {
  purchaseCreateValidation,
  purchaseQueryValidation,
  purchaseUpdateBodyValidation,
} from "../../validations/purchase.validation.js";
import {
  confirmPurchaseService,
  createPurchaseService,
  deletePurchaseService,
  getPurchaseService,
  getPurchasesService,
  revertPurchaseToDraftService,
  updatePurchaseService,
} from "../../services/inventoryConcept/purchase.service.js";
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

export async function createPurchase(req, res) {
  try {
    const { error } = purchaseCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [purchase, purchaseError] = await createPurchaseService(
      req.body,
      buildAuthContext(req),
    );

    if (purchaseError) return handleErrorClient(res, 400, purchaseError);
    handleSuccess(res, 201, "Compra creada correctamente", purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getPurchase(req, res) {
  try {
    const { error } = purchaseQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [purchase, purchaseError] = await getPurchaseService(req.query);

    if (purchaseError) return handleErrorClient(res, 404, purchaseError);
    handleSuccess(res, 200, "Compra encontrada", purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getPurchases(req, res) {
  try {
    const [purchases, purchasesError] = await getPurchasesService();
    if (purchasesError) return handleErrorClient(res, 404, purchasesError);
    handleSuccess(res, 200, "Compras encontradas", purchases);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updatePurchase(req, res) {
  try {
    const { error: queryError } = purchaseQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = purchaseUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [purchase, purchaseError] = await updatePurchaseService(
      req.query,
      req.body,
      buildAuthContext(req),
    );

    if (purchaseError) return handleErrorClient(res, 400, purchaseError);
    handleSuccess(res, 200, "Compra modificada correctamente", purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function confirmPurchase(req, res) {
  try {
    const { compra_id } = req.params;
    const { error } = purchaseQueryValidation.validate({ compra_id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", error.message);
    }

    const [purchase, purchaseError] = await confirmPurchaseService(
      { compra_id },
      buildAuthContext(req),
    );

    if (purchaseError) return handleErrorClient(res, 400, purchaseError);
    handleSuccess(res, 200, "Compra confirmada correctamente", purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function revertPurchaseToDraft(req, res) {
  try {
    const { compra_id } = req.params;
    const { error } = purchaseQueryValidation.validate({ compra_id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", error.message);
    }

    const [purchase, purchaseError] = await revertPurchaseToDraftService({ compra_id });

    if (purchaseError) return handleErrorClient(res, 400, purchaseError);
    handleSuccess(res, 200, "Compra devuelta a borrador correctamente", purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deletePurchase(req, res) {
  try {
    const { error } = purchaseQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [purchase, purchaseError] = await deletePurchaseService(req.query);
    if (purchaseError) return handleErrorClient(res, 400, purchaseError);
    const successMessage = purchase?.operacion === "cancelacion_logica"
      ? "Compra cancelada logicamente y cuenta por pagar anulada correctamente"
      : "Compra eliminada correctamente";
    handleSuccess(res, 200, successMessage, purchase);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

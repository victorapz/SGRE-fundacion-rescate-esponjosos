"use strict";

import {
  purchaseDetailCreateValidation,
  purchaseDetailQueryValidation,
  purchaseDetailUpdateBodyValidation,
  receivePurchaseDetailsBulkValidation,
  receivePurchaseDetailValidation,
} from "../../validations/purchase_detail.validation.js";
import {
  createPurchaseDetailService,
  deletePurchaseDetailService,
  getPurchaseDetailService,
  getPurchaseDetailsService,
  receivePurchaseDetailsBulkService,
  receivePurchaseDetailService,
  updatePurchaseDetailService,
} from "../../services/inventoryConcept/purchase_detail.service.js";
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

export async function createPurchaseDetail(req, res) {
  try {
    const { error } = purchaseDetailCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [detail, detailError] = await createPurchaseDetailService(req.body);
    if (detailError) return handleErrorClient(res, 400, detailError);
    handleSuccess(res, 201, "Detalle de compra creado correctamente", detail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getPurchaseDetail(req, res) {
  try {
    const { error } = purchaseDetailQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [detail, detailError] = await getPurchaseDetailService(req.query);
    if (detailError) return handleErrorClient(res, 404, detailError);
    handleSuccess(res, 200, "Detalle de compra encontrado", detail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getPurchaseDetails(req, res) {
  try {
    const [details, detailsError] = await getPurchaseDetailsService();
    if (detailsError) return handleErrorClient(res, 404, detailsError);
    handleSuccess(res, 200, "Detalles de compra encontrados", details);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updatePurchaseDetail(req, res) {
  try {
    const { error: queryError } = purchaseDetailQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = purchaseDetailUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [detail, detailError] = await updatePurchaseDetailService(req.query, req.body);
    if (detailError) return handleErrorClient(res, 400, detailError);
    handleSuccess(res, 200, "Detalle de compra modificado correctamente", detail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deletePurchaseDetail(req, res) {
  try {
    const { error } = purchaseDetailQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [detail, detailError] = await deletePurchaseDetailService(req.query);
    if (detailError) return handleErrorClient(res, 400, detailError);
    handleSuccess(res, 200, "Detalle de compra eliminado correctamente", detail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function receivePurchaseDetail(req, res) {
  try {
    const { error } = receivePurchaseDetailValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, receiveError] = await receivePurchaseDetailService(
      req.body,
      buildAuthContext(req),
    );

    if (receiveError) return handleErrorClient(res, 400, receiveError);
    handleSuccess(res, 201, "Recepcion de compra registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function receivePurchaseDetailsBulk(req, res) {
  try {
    const { error } = receivePurchaseDetailsBulkValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, receiveError] = await receivePurchaseDetailsBulkService(
      req.body,
      buildAuthContext(req),
    );

    if (receiveError) return handleErrorClient(res, 400, receiveError);
    handleSuccess(res, 201, "Recepcion masiva de compra registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

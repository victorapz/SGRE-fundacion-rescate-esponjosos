"use strict";

import {
  stockCountDetailCreateValidation,
  stockCountDetailQueryValidation,
  stockCountDetailUpdateBodyValidation,
} from "../../validations/stock_count_detail.validation.js";

import {
  createStockCountDetailService,
  deleteStockCountDetailService,
  getStockCountDetailService,
  getStockCountDetailsService,
  updateStockCountDetailService,
} from "../../services/inventoryConcept/stock_count_detail.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createStockCountDetail(req, res) {
  try {
    const { body } = req;

    const { error } = stockCountDetailCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [stockCountDetail, errorStockCountDetail] =
      await createStockCountDetailService(body);

    if (errorStockCountDetail)
      return handleErrorClient(res, 400, errorStockCountDetail);

    handleSuccess(
      res,
      201,
      "Detalle de conteo creado correctamente",
      stockCountDetail,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getStockCountDetail(req, res) {
  try {
    const { conteo_detalle_id } = req.query;

    const { error } = stockCountDetailQueryValidation.validate({ conteo_detalle_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [stockCountDetail, errorStockCountDetail] =
      await getStockCountDetailService({ conteo_detalle_id });

    if (errorStockCountDetail)
      return handleErrorClient(res, 404, errorStockCountDetail);

    handleSuccess(res, 200, "Detalle de conteo encontrado", stockCountDetail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getStockCountDetails(req, res) {
  try {
    const [stockCountDetails, errorStockCountDetails] =
      await getStockCountDetailsService();

    if (errorStockCountDetails)
      return handleErrorClient(res, 404, errorStockCountDetails);

    stockCountDetails.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Detalles de conteo encontrados", stockCountDetails);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateStockCountDetail(req, res) {
  try {
    const { conteo_detalle_id } = req.query;
    const { body } = req;

    const { error: queryError } = stockCountDetailQueryValidation.validate({
      conteo_detalle_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const { error: bodyError } = stockCountDetailUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [stockCountDetail, errorStockCountDetail] =
      await updateStockCountDetailService({ conteo_detalle_id }, body);

    if (errorStockCountDetail)
      return handleErrorClient(
        res,
        400,
        "Error modificando el detalle de conteo",
        errorStockCountDetail,
      );

    handleSuccess(
      res,
      200,
      "Detalle de conteo modificado correctamente",
      stockCountDetail,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteStockCountDetail(req, res) {
  try {
    const { conteo_detalle_id } = req.query;

    const { error: queryError } = stockCountDetailQueryValidation.validate({
      conteo_detalle_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const [stockCountDetailDeleted, errorStockCountDetailDeleted] =
      await deleteStockCountDetailService({ conteo_detalle_id });

    if (errorStockCountDetailDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el detalle de conteo",
        errorStockCountDetailDeleted,
      );

    handleSuccess(
      res,
      200,
      "Detalle de conteo eliminado correctamente",
      stockCountDetailDeleted,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

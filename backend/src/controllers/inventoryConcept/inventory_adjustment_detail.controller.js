"use strict";

import {
  inventoryAdjustmentDetailCreateValidation,
  inventoryAdjustmentDetailQueryValidation,
  inventoryAdjustmentDetailUpdateBodyValidation,
} from "../../validations/inventory_adjustment_detail.validation.js";

import {
  createInventoryAdjustmentDetailService,
  deleteInventoryAdjustmentDetailService,
  getInventoryAdjustmentDetailService,
  getInventoryAdjustmentDetailsService,
  updateInventoryAdjustmentDetailService,
} from "../../services/inventoryConcept/inventory_adjustment_detail.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createInventoryAdjustmentDetail(req, res) {
  try {
    const { body } = req;

    const { error } = inventoryAdjustmentDetailCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [inventoryAdjustmentDetail, errorInventoryAdjustmentDetail] =
      await createInventoryAdjustmentDetailService(body);

    if (errorInventoryAdjustmentDetail)
      return handleErrorClient(res, 400, errorInventoryAdjustmentDetail);

    handleSuccess(
      res,
      201,
      "Detalle de ajuste creado correctamente",
      inventoryAdjustmentDetail,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryAdjustmentDetail(req, res) {
  try {
    const { ajuste_detalle_id } = req.query;

    const { error } = inventoryAdjustmentDetailQueryValidation.validate({
      ajuste_detalle_id,
    });

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [inventoryAdjustmentDetail, errorInventoryAdjustmentDetail] =
      await getInventoryAdjustmentDetailService({ ajuste_detalle_id });

    if (errorInventoryAdjustmentDetail)
      return handleErrorClient(res, 404, errorInventoryAdjustmentDetail);

    handleSuccess(
      res,
      200,
      "Detalle de ajuste encontrado",
      inventoryAdjustmentDetail,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryAdjustmentDetails(req, res) {
  try {
    const [inventoryAdjustmentDetails, errorInventoryAdjustmentDetails] =
      await getInventoryAdjustmentDetailsService();

    if (errorInventoryAdjustmentDetails)
      return handleErrorClient(res, 404, errorInventoryAdjustmentDetails);

    inventoryAdjustmentDetails.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(
          res,
          200,
          "Detalles de ajustes encontrados",
          inventoryAdjustmentDetails,
        );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateInventoryAdjustmentDetail(req, res) {
  try {
    const { ajuste_detalle_id } = req.query;
    const { body } = req;

    const { error: queryError } = inventoryAdjustmentDetailQueryValidation.validate({
      ajuste_detalle_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const { error: bodyError } = inventoryAdjustmentDetailUpdateBodyValidation.validate(
      body,
    );

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [inventoryAdjustmentDetail, errorInventoryAdjustmentDetail] =
      await updateInventoryAdjustmentDetailService({ ajuste_detalle_id }, body);

    if (errorInventoryAdjustmentDetail)
      return handleErrorClient(
        res,
        400,
        "Error modificando el detalle de ajuste",
        errorInventoryAdjustmentDetail,
      );

    handleSuccess(
      res,
      200,
      "Detalle de ajuste modificado correctamente",
      inventoryAdjustmentDetail,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteInventoryAdjustmentDetail(req, res) {
  try {
    const { ajuste_detalle_id } = req.query;

    const { error: queryError } = inventoryAdjustmentDetailQueryValidation.validate({
      ajuste_detalle_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const [inventoryAdjustmentDetailDeleted, errorInventoryAdjustmentDetailDeleted] =
      await deleteInventoryAdjustmentDetailService({ ajuste_detalle_id });

    if (errorInventoryAdjustmentDetailDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el detalle de ajuste",
        errorInventoryAdjustmentDetailDeleted,
      );

    handleSuccess(
      res,
      200,
      "Detalle de ajuste eliminado correctamente",
      inventoryAdjustmentDetailDeleted,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  inventoryAdjustmentCreateValidation,
  inventoryAdjustmentFromStockCountValidation,
  inventoryAdjustmentManualValidation,
  inventoryAdjustmentQueryValidation,
  inventoryAdjustmentUpdateBodyValidation,
} from "../../validations/inventory_adjustment.validation.js";
import {
  applyInventoryAdjustmentService,
  createAdjustmentFromStockCountService,
  createInventoryAdjustmentService,
  createManualInventoryAdjustmentService,
  deleteInventoryAdjustmentService,
  getInventoryAdjustmentService,
  getInventoryAdjustmentsService,
  updateInventoryAdjustmentService,
} from "../../services/inventoryConcept/inventory_adjustment.service.js";
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

export async function createInventoryAdjustment(req, res) {
  try {
    const { error } = inventoryAdjustmentCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [adjustment, adjustmentError] = await createInventoryAdjustmentService(
      req.body,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 400, adjustmentError);
    handleSuccess(res, 201, "Ajuste de inventario creado correctamente", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryAdjustment(req, res) {
  try {
    const { error } = inventoryAdjustmentQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [adjustment, adjustmentError] = await getInventoryAdjustmentService(
      req.query,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 404, adjustmentError);
    handleSuccess(res, 200, "Ajuste de inventario encontrado", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryAdjustments(req, res) {
  try {
    const [adjustments, adjustmentsError] = await getInventoryAdjustmentsService(
      buildAuthContext(req),
    );

    if (adjustmentsError) return handleErrorClient(res, 404, adjustmentsError);
    handleSuccess(res, 200, "Ajustes de inventario encontrados", adjustments);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateInventoryAdjustment(req, res) {
  try {
    const { error: queryError } = inventoryAdjustmentQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = inventoryAdjustmentUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [adjustment, adjustmentError] = await updateInventoryAdjustmentService(
      req.query,
      req.body,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 400, adjustmentError);
    handleSuccess(res, 200, "Ajuste de inventario modificado correctamente", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteInventoryAdjustment(req, res) {
  try {
    const { error } = inventoryAdjustmentQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [adjustment, adjustmentError] = await deleteInventoryAdjustmentService(
      req.query,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 400, adjustmentError);
    handleSuccess(res, 200, "Ajuste de inventario cancelado correctamente", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function createAdjustmentFromStockCount(req, res) {
  try {
    const { error } = inventoryAdjustmentFromStockCountValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [adjustment, adjustmentError] = await createAdjustmentFromStockCountService(
      req.body,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 400, adjustmentError);
    handleSuccess(res, 201, "Ajuste desde conteo fisico creado correctamente", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function createManualInventoryAdjustment(req, res) {
  try {
    const { error } = inventoryAdjustmentManualValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [adjustment, adjustmentError] = await createManualInventoryAdjustmentService(
      req.body,
      buildAuthContext(req),
    );

    if (adjustmentError) return handleErrorClient(res, 400, adjustmentError);
    handleSuccess(res, 201, "Ajuste manual creado correctamente", adjustment);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function applyInventoryAdjustment(req, res) {
  try {
    const { error } = inventoryAdjustmentQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, applyError] = await applyInventoryAdjustmentService(
      req.query,
      buildAuthContext(req),
    );

    if (applyError) return handleErrorClient(res, 400, applyError);
    handleSuccess(res, 200, "Ajuste aplicado correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

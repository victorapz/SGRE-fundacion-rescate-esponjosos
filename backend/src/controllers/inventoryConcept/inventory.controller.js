"use strict";

import {
  consumeInventoryValidation,
  exitInventoryValidation,
  initialInventoryLoadValidation,
  inventoryItemDetailQueryValidation,
  inventorySummaryQueryValidation,
  transferInventoryValidation,
} from "../../validations/inventory.validation.js";
import {
  consumeInventoryService,
  createInitialInventoryLoadService,
  exitInventoryService,
  getInventorySummaryService,
  getItemDetailService,
  transferInventoryService,
} from "../../services/inventoryConcept/inventory.service.js";
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

export async function getInventorySummary(req, res) {
  try {
    const { error } = inventorySummaryQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [summary, summaryError] = await getInventorySummaryService(
      req.query,
      buildAuthContext(req),
    );

    if (summaryError) return handleErrorClient(res, 400, summaryError);
    handleSuccess(res, 200, "Resumen de inventario obtenido correctamente", summary);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryItemDetail(req, res) {
  try {
    const { error } = inventoryItemDetailQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [detail, detailError] = await getItemDetailService(
      req.query,
      buildAuthContext(req),
    );

    if (detailError) return handleErrorClient(res, 400, detailError);
    handleSuccess(res, 200, "Detalle de inventario obtenido correctamente", detail);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function consumeInventory(req, res) {
  try {
    const { error } = consumeInventoryValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, consumeError] = await consumeInventoryService(
      req.body,
      buildAuthContext(req),
    );

    if (consumeError) return handleErrorClient(res, 400, consumeError);
    handleSuccess(res, 201, "Consumo de inventario registrado correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function exitInventory(req, res) {
  try {
    const { error } = exitInventoryValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, exitError] = await exitInventoryService(
      req.body,
      buildAuthContext(req),
    );

    if (exitError) return handleErrorClient(res, 400, exitError);
    handleSuccess(res, 201, "Salida de inventario registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function transferInventory(req, res) {
  try {
    const { error } = transferInventoryValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, transferError] = await transferInventoryService(
      req.body,
      buildAuthContext(req),
    );

    if (transferError) return handleErrorClient(res, 400, transferError);
    handleSuccess(res, 201, "Traslado de inventario registrado correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function createInitialInventoryLoad(req, res) {
  try {
    const { error } = initialInventoryLoadValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, loadError] = await createInitialInventoryLoadService(
      req.body,
      buildAuthContext(req),
    );

    if (loadError) return handleErrorClient(res, 400, loadError);
    handleSuccess(res, 201, "Carga inicial de inventario registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

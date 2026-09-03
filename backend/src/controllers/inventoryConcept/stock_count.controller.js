"use strict";

import {
  stockCountCreateValidation,
  stockCountQueryValidation,
  stockCountUpdateBodyValidation,
} from "../../validations/stock_count.validation.js";
import {
  createStockCountService,
  deleteStockCountService,
  getStockCountService,
  getStockCountsService,
  updateStockCountService,
} from "../../services/inventoryConcept/stock_count.service.js";
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

export async function createStockCount(req, res) {
  try {
    const { error } = stockCountCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [stockCount, stockCountError] = await createStockCountService(
      req.body,
      buildAuthContext(req),
    );

    if (stockCountError) return handleErrorClient(res, 400, stockCountError);
    handleSuccess(res, 201, "Conteo fisico creado correctamente", stockCount);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getStockCount(req, res) {
  try {
    const { error } = stockCountQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [stockCount, stockCountError] = await getStockCountService(
      req.query,
      buildAuthContext(req),
    );

    if (stockCountError) return handleErrorClient(res, 404, stockCountError);
    handleSuccess(res, 200, "Conteo fisico encontrado", stockCount);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getStockCounts(req, res) {
  try {
    const [stockCounts, stockCountsError] = await getStockCountsService(buildAuthContext(req));
    if (stockCountsError) return handleErrorClient(res, 404, stockCountsError);
    handleSuccess(res, 200, "Conteos fisicos encontrados", stockCounts);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateStockCount(req, res) {
  try {
    const { error: queryError } = stockCountQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = stockCountUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [stockCount, stockCountError] = await updateStockCountService(
      req.query,
      req.body,
      buildAuthContext(req),
    );

    if (stockCountError) return handleErrorClient(res, 400, stockCountError);
    handleSuccess(res, 200, "Conteo fisico modificado correctamente", stockCount);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteStockCount(req, res) {
  try {
    const { error } = stockCountQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [stockCount, stockCountError] = await deleteStockCountService(
      req.query,
      buildAuthContext(req),
    );

    if (stockCountError) return handleErrorClient(res, 400, stockCountError);
    handleSuccess(res, 200, "Conteo fisico eliminado correctamente", stockCount);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  inventoryExistenceListValidation,
  inventoryExistenceQueryValidation,
} from "../../validations/inventory_existence.validation.js";
import {
  getInventoryExistenceService,
  getInventoryExistencesService,
} from "../../services/inventoryConcept/inventory_existence.service.js";
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

export async function getInventoryExistence(req, res) {
  try {
    const { error } = inventoryExistenceQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [existence, existenceError] = await getInventoryExistenceService(
      req.query,
      buildAuthContext(req),
    );

    if (existenceError) return handleErrorClient(res, 404, existenceError);
    handleSuccess(res, 200, "Existencia de inventario encontrada", existence);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryExistences(req, res) {
  try {
    const { error } = inventoryExistenceListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [existences, existencesError] = await getInventoryExistencesService(
      req.query,
      buildAuthContext(req),
    );

    if (existencesError) return handleErrorClient(res, 404, existencesError);
    handleSuccess(res, 200, "Existencias de inventario encontradas", existences);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

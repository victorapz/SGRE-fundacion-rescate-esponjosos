"use strict";

import {
  inventoryMovementListValidation,
  inventoryMovementQueryValidation,
} from "../../validations/inventory_movement.validation.js";
import {
  getInventoryMovementService,
  getInventoryMovementsService,
} from "../../services/inventoryConcept/inventory_movement.service.js";
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

export async function getInventoryMovement(req, res) {
  try {
    const { error } = inventoryMovementQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [movement, movementError] = await getInventoryMovementService(
      req.query,
      buildAuthContext(req),
    );

    if (movementError) return handleErrorClient(res, 404, movementError);
    handleSuccess(res, 200, "Movimiento de inventario encontrado", movement);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getInventoryMovements(req, res) {
  try {
    const { error } = inventoryMovementListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [movements, movementsError] = await getInventoryMovementsService(
      req.query,
      buildAuthContext(req),
    );

    if (movementsError) return handleErrorClient(res, 404, movementsError);
    handleSuccess(res, 200, "Movimientos de inventario encontrados", movements);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

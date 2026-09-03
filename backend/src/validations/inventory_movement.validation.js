"use strict";

import Joi from "joi";
import { idSchema } from "./inventory.shared.validation.js";

export const inventoryMovementQueryValidation = Joi.object({
  movimiento_id: idSchema("movimiento_id").required().messages({
    "any.required": "movimiento_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryMovementListValidation = Joi.object({
  item_id: idSchema("item_id").optional(),
  location_id: idSchema("location_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryMovementCreateValidation = Joi.object({}).forbidden();
export const inventoryMovementUpdateBodyValidation = Joi.object({}).forbidden();

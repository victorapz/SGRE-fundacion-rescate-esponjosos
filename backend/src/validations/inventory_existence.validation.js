"use strict";

import Joi from "joi";
import {
  idSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

const condicionSchema = Joi.string()
  .valid("NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO")
  .optional();

const estadoSchema = Joi.string()
  .valid("DISPONIBLE", "AGOTADO", "DESCARTADO")
  .optional();

export const inventoryExistenceQueryValidation = Joi.object({
  existencia_id: idSchema("existencia_id").required().messages({
    "any.required": "existencia_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryExistenceListValidation = Joi.object({
  item_id: idSchema("item_id").optional(),
  location_id: idSchema("location_id").optional(),
  estado: estadoSchema,
  condicion: condicionSchema,
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryExistenceUpdateBodyValidation = Joi.object({
  observaciones: optionalTextSchema("Las observaciones"),
  estado: estadoSchema,
})
  .or("observaciones", "estado")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

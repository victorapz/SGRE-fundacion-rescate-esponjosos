"use strict";

import Joi from "joi";
import {
  idSchema,
  isoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";
import { stockCountDetailCreateValidation } from "./stock_count_detail.validation.js";

export const stockCountQueryValidation = Joi.object({
  conteo_fisico_id: idSchema("conteo_fisico_id").required().messages({
    "any.required": "conteo_fisico_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const stockCountCreateValidation = Joi.object({
  fecha_conteo: isoDateSchema("La fecha de conteo").required().messages({
    "any.required": "La fecha de conteo es obligatoria.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  location_id: idSchema("location_id").required().messages({
    "any.required": "location_id es obligatorio.",
  }),
  performed_by_id: idSchema("performed_by_id").optional(),
  detalles: Joi.array().items(
    stockCountDetailCreateValidation.fork(
      ["stock_count_id"],
      (schema) => schema.forbidden(),
    ),
  ).min(1).required().messages({
    "array.base": "detalles debe ser una lista.",
    "array.min": "Debes proporcionar al menos un detalle de conteo.",
    "any.required": "detalles es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const stockCountUpdateBodyValidation = Joi.object({
  fecha_conteo: isoDateSchema("La fecha de conteo"),
  observaciones: optionalTextSchema("Las observaciones"),
  location_id: idSchema("location_id"),
  performed_by_id: idSchema("performed_by_id"),
})
  .or("fecha_conteo", "observaciones", "location_id", "performed_by_id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

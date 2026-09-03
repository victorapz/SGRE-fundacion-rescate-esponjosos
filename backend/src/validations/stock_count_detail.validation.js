"use strict";

import Joi from "joi";
import {
  idSchema,
  nonNegativeNumberSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

export const stockCountDetailQueryValidation = Joi.object({
  conteo_detalle_id: idSchema("conteo_detalle_id").required().messages({
    "any.required": "conteo_detalle_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const stockCountDetailCreateValidation = Joi.object({
  cantidad_contada: nonNegativeNumberSchema("La cantidad contada").required().messages({
    "any.required": "La cantidad contada es obligatoria.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  stock_count_id: idSchema("stock_count_id").required().messages({
    "any.required": "stock_count_id es obligatorio.",
  }),
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
  existencia_id: idSchema("existencia_id").optional().allow(null),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const stockCountDetailUpdateBodyValidation = Joi.object({
  cantidad_contada: nonNegativeNumberSchema("La cantidad contada"),
  observaciones: optionalTextSchema("Las observaciones"),
  stock_count_id: idSchema("stock_count_id"),
  item_id: idSchema("item_id"),
  existencia_id: idSchema("existencia_id").optional().allow(null),
})
  .or("cantidad_contada", "observaciones", "stock_count_id", "item_id", "existencia_id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

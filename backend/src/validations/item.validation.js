"use strict";

import Joi from "joi";
import {
  idSchema,
  nonNegativeNumberSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const nameSchema = requiredTextSchema("El nombre", 255);

export const itemQueryValidation = Joi.object({
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const itemCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  descripcion: optionalTextSchema("La descripcion"),
  stock_minimo: nonNegativeNumberSchema("El stock minimo").allow(null),
  activo: Joi.boolean().optional(),
  categoria_item_id: idSchema("categoria_item_id").required().messages({
    "any.required": "categoria_item_id es obligatorio.",
  }),
  unidad_medida_id: idSchema("unidad_medida_id").required().messages({
    "any.required": "unidad_medida_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const itemUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  descripcion: optionalTextSchema("La descripcion"),
  stock_minimo: nonNegativeNumberSchema("El stock minimo").allow(null),
  activo: Joi.boolean(),
  categoria_item_id: idSchema("categoria_item_id"),
  unidad_medida_id: idSchema("unidad_medida_id"),
})
  .or(
    "nombre",
    "descripcion",
    "stock_minimo",
    "activo",
    "categoria_item_id",
    "unidad_medida_id",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

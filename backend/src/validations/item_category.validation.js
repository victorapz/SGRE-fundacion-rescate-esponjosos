"use strict";

import Joi from "joi";
import { idSchema, requiredTextSchema } from "./inventory.shared.validation.js";

const nameSchema = requiredTextSchema("El nombre de la categoria", 255);

export const itemCategoryQueryValidation = Joi.object({
  categoria_item_id: idSchema("categoria_item_id").required().messages({
    "any.required": "categoria_item_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const itemCategoryCreateValidation = Joi.object({
  nombre_categoria: nameSchema.required().messages({
    "any.required": "El nombre de la categoria es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const itemCategoryUpdateBodyValidation = Joi.object({
  nombre_categoria: nameSchema,
  activo: Joi.boolean(),
})
  .or("nombre_categoria", "activo")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

"use strict";

import Joi from "joi";
import {
  idSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const categoryTypeValues = ["INGRESO", "EGRESO", "AMBOS"];

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const claveSchema = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z0-9_]+$/)
  .max(120)
  .messages({
    "string.base": "La clave debe ser de tipo string.",
    "string.empty": "La clave no puede estar vacia.",
    "string.max": "La clave debe tener como maximo 120 caracteres.",
    "string.pattern.base": "La clave solo puede contener letras mayusculas, numeros y guion bajo.",
  });

export const transactionCategoryQueryValidation = Joi.object({
  categoria_transaccion_id: idSchema("categoria_transaccion_id").required().messages({
    "any.required": "categoria_transaccion_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionCategoryListValidation = Joi.object({
  ...paginationSchema,
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...categoryTypeValues)
    .optional(),
  activo: Joi.boolean().optional(),
  es_sistema: Joi.boolean().optional(),
  categoria_padre_id: idSchema("categoria_padre_id").optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionCategoryCreateValidation = Joi.object({
  clave: claveSchema.required().messages({
    "any.required": "La clave es obligatoria.",
  }),
  nombre: requiredTextSchema("El nombre", 255).required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...categoryTypeValues)
    .required()
    .messages({
      "any.required": "El tipo es obligatorio.",
      "any.only": `El tipo debe ser uno de: ${categoryTypeValues.join(", ")}.`,
    }),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  categoria_padre_id: idSchema("categoria_padre_id").allow(null).optional(),
  activo: Joi.boolean().optional(),
  es_sistema: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionCategoryUpdateBodyValidation = Joi.object({
  clave: claveSchema.optional(),
  nombre: requiredTextSchema("El nombre", 255).optional(),
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...categoryTypeValues)
    .optional(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  categoria_padre_id: idSchema("categoria_padre_id").allow(null).optional(),
  activo: Joi.boolean().optional(),
  es_sistema: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debes enviar al menos un campo para actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

"use strict";

import Joi from "joi";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const nameSchema = Joi.string().trim().min(1).max(255).messages({
  "string.empty": "El nombre no puede estar vacio.",
  "string.base": "El nombre debe ser de tipo string.",
  "string.min": "El nombre debe tener al menos 1 caracter.",
  "string.max": "El nombre debe tener como maximo 255 caracteres.",
});

export const comunaQueryValidation = Joi.object({
  id_comuna: idSchema.required().messages({
    "any.required": "id_comuna es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const comunaCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  codigo: Joi.string().trim().max(50).allow(null, "").optional().messages({
    "string.base": "El código debe ser de tipo string.",
    "string.max": "El código no puede superar 50 caracteres.",
  }),
  region_id: idSchema.required().messages({
    "any.required": "region_id es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const comunaUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  codigo: Joi.string().trim().max(50).allow(null, "").messages({
    "string.base": "El código debe ser de tipo string.",
    "string.max": "El código no puede superar 50 caracteres.",
  }),
  region_id: idSchema,
  activo: Joi.boolean(),
})
  .or("nombre", "codigo", "region_id", "activo")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

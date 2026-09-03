"use strict";

import Joi from "joi";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un número.",
  "number.integer": "El id debe ser un número entero.",
  "number.positive": "El id debe ser un número positivo.",
});

const nombreSchema = Joi.string().trim().min(1).max(255).messages({
  "string.empty": "El nombre es obligatorio.",
  "string.base": "El nombre debe ser de tipo texto.",
  "string.min": "El nombre debe tener al menos 1 caracter.",
  "string.max": "El nombre no puede superar 255 caracteres.",
});

const claveSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[A-Za-z0-9-]+$/)
  .messages({
    "string.empty": "El código es obligatorio.",
    "string.base": "El código debe ser de tipo texto.",
    "string.min": "El código debe tener al menos 2 caracteres.",
    "string.max": "El código no puede superar 50 caracteres.",
    "string.pattern.base":
      "El código solo puede contener letras, números y guiones.",
  });

export const regionQueryValidation = Joi.object({
  id_region: idSchema.required().messages({
    "any.required": "id_region es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const regionCreateValidation = Joi.object({
  nombre: nombreSchema.required(),
  clave: claveSchema.required(),
  activo: Joi.boolean().optional(),
  orden: Joi.number().integer().min(0).optional().messages({
    "number.base": "El orden debe ser numérico.",
    "number.integer": "El orden debe ser un número entero.",
    "number.min": "El orden no puede ser negativo.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const regionUpdateValidation = Joi.object({
  nombre: nombreSchema,
  clave: claveSchema,
  activo: Joi.boolean(),
  orden: Joi.number().integer().min(0).messages({
    "number.base": "El orden debe ser numérico.",
    "number.integer": "El orden debe ser un número entero.",
    "number.min": "El orden no puede ser negativo.",
  }),
})
  .or("nombre", "clave", "activo", "orden")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

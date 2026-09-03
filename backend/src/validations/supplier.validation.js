"use strict";

import Joi from "joi";
import { nestedLocationPayloadValidation } from "./location.validation.js";

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

const optionalStringSchema = Joi.string().trim().allow(null, "").messages({
  "string.base": "Este campo debe ser de tipo string.",
});

export const supplierQueryValidation = Joi.object({
  proveedor_id: idSchema.required().messages({
    "any.required": "proveedor_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const supplierCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  telefono: optionalStringSchema.optional(),
  email: optionalStringSchema.optional(),
  observaciones: optionalStringSchema.optional(),
  activo: Joi.boolean().optional(),
  location: nestedLocationPayloadValidation.optional().allow(null),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const supplierUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  telefono: optionalStringSchema,
  email: optionalStringSchema,
  observaciones: optionalStringSchema,
  activo: Joi.boolean(),
  location: nestedLocationPayloadValidation.allow(null),
})
  .or("nombre", "telefono", "email", "observaciones", "activo", "location")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

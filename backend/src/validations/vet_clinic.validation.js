"use strict";

import Joi from "joi";
import { nestedLocationPayloadValidation } from "./location.validation.js";

const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(255)
  .messages({
    "string.empty": "El nombre no puede estar vacio.",
    "string.base": "El nombre debe ser de tipo string.",
    "string.min": "El nombre debe tener como minimo 2 caracteres.",
    "string.max": "El nombre debe tener como maximo 255 caracteres.",
  });

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const veterinarianIdsSchema = Joi.array()
  .items(idSchema)
  .unique()
  .messages({
    "array.base": "veterinarian_ids debe ser un arreglo.",
  });

export const vetClinicQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const vetClinicListQueryValidation = Joi.object({
  activo: Joi.boolean().optional(),
  search: Joi.string().trim().allow("").optional(),
  region_id: idSchema.optional(),
  comuna_id: idSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const vetClinicCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
  location: nestedLocationPayloadValidation.required().messages({
    "any.required": "location es obligatorio.",
  }),
  veterinarian_ids: veterinarianIdsSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const vetClinicUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  activo: Joi.boolean(),
  location: nestedLocationPayloadValidation,
  veterinarian_ids: veterinarianIdsSchema,
})
  .or("nombre", "activo", "location", "veterinarian_ids")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

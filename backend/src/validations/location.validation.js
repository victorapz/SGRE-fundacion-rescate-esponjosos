"use strict";

import Joi from "joi";
import { LOCATION_TYPES } from "../entities/inventoryConcept/location.entity.js";

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

const requiredString255Schema = Joi.string().trim().min(1).max(255).messages({
  "string.empty": "Este campo no puede estar vacio.",
  "string.base": "Este campo debe ser de tipo string.",
  "string.min": "Este campo debe tener al menos 1 caracter.",
  "string.max": "Este campo debe tener como maximo 255 caracteres.",
});

const optionalTextSchema = Joi.string().trim().allow(null, "").messages({
  "string.base": "Este campo debe ser de tipo string.",
});

const tipoSchema = Joi.string()
  .valid(...Object.values(LOCATION_TYPES))
  .messages({
    "any.only": "El tipo no es valido.",
    "string.base": "El tipo debe ser de tipo string.",
  });

export const nestedLocationPayloadValidation = Joi.object({
  direccion: requiredString255Schema.required().messages({
    "any.required": "La direccion es obligatoria.",
  }),
  region_id: idSchema.required().messages({
    "any.required": "region_id es obligatorio.",
  }),
  comuna_id: idSchema.required().messages({
    "any.required": "comuna_id es obligatorio.",
  }),
  observaciones: optionalTextSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en location.",
  });

export const locationQueryValidation = Joi.object({
  ubicacion_id: idSchema.required().messages({
    "any.required": "ubicacion_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const locationCreateValidation = Joi.object({
  tipo: tipoSchema.required().messages({
    "any.required": "El tipo es obligatorio.",
  }),
  nombre_ubicacion: nameSchema.required().messages({
    "any.required": "El nombre de ubicacion es obligatorio.",
  }),
  direccion: requiredString255Schema.required().messages({
    "any.required": "La direccion es obligatoria.",
  }),
  region_id: idSchema.required().messages({
    "any.required": "region_id es obligatorio.",
  }),
  comuna_id: idSchema.required().messages({
    "any.required": "comuna_id es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
  observaciones: optionalTextSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const locationUpdateBodyValidation = Joi.object({
  tipo: tipoSchema,
  nombre_ubicacion: nameSchema,
  direccion: requiredString255Schema,
  region_id: idSchema,
  comuna_id: idSchema,
  activo: Joi.boolean(),
  observaciones: optionalTextSchema,
})
  .or(
    "tipo",
    "nombre_ubicacion",
    "direccion",
    "region_id",
    "comuna_id",
    "activo",
    "observaciones",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

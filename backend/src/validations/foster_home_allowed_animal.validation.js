"use strict";

import Joi from "joi";
import {
  AnimalHealthStatusENUM,
  AnimalSpeciesENUM,
} from "../entities/foster_home_allowed_animals.js";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const optionalTextSchema = Joi.string().allow("").optional().messages({
  "string.base": "Este campo debe ser de tipo string.",
});

export const allowedAnimalBodySchema = Joi.object({
  especie: Joi.string()
    .valid(...Object.values(AnimalSpeciesENUM))
    .required()
    .messages({
      "any.required": "La especie es obligatoria.",
      "any.only": "La especie no es valida.",
      "string.base": "La especie debe ser de tipo string.",
    }),
  estado_permitido: Joi.string()
    .valid(...Object.values(AnimalHealthStatusENUM))
    .required()
    .messages({
      "any.required": "El estado permitido es obligatorio.",
      "any.only": "El estado permitido no es valido.",
      "string.base": "El estado permitido debe ser de tipo string.",
    }),
  capacidad_maxima: Joi.number().integer().positive().allow(null).optional().messages({
    "number.base": "La capacidad maxima debe ser un numero.",
    "number.integer": "La capacidad maxima debe ser un numero entero.",
    "number.positive": "La capacidad maxima debe ser positiva.",
  }),
  observaciones: optionalTextSchema,
  activo: Joi.boolean().optional().messages({
    "boolean.base": "activo debe ser boolean.",
  }),
});

export const fosterHomeAllowedAnimalQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const fosterHomeAllowedAnimalListQueryValidation = Joi.object({
  foster_home_id: idSchema.required().messages({
    "any.required": "foster_home_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterHomeAllowedAnimalCreateValidation = allowedAnimalBodySchema.keys({
  foster_home_id: idSchema.required().messages({
    "any.required": "foster_home_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterHomeAllowedAnimalUpdateBodyValidation = Joi.object({
  especie: Joi.string()
    .valid(...Object.values(AnimalSpeciesENUM))
    .messages({
      "any.only": "La especie no es valida.",
      "string.base": "La especie debe ser de tipo string.",
    }),
  estado_permitido: Joi.string()
    .valid(...Object.values(AnimalHealthStatusENUM))
    .messages({
      "any.only": "El estado permitido no es valido.",
      "string.base": "El estado permitido debe ser de tipo string.",
    }),
  capacidad_maxima: Joi.number().integer().positive().allow(null).messages({
    "number.base": "La capacidad maxima debe ser un numero.",
    "number.integer": "La capacidad maxima debe ser un numero entero.",
    "number.positive": "La capacidad maxima debe ser positiva.",
  }),
  observaciones: Joi.string().allow(""),
  activo: Joi.boolean(),
})
  .or("especie", "estado_permitido", "capacidad_maxima", "observaciones", "activo")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

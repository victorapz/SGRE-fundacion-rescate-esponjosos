"use strict";

import Joi from "joi";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const textSchema = Joi.string().trim().min(1).messages({
  "string.base": "El texto debe ser de tipo string.",
  "string.empty": "El texto no puede estar vacio.",
  "string.min": "El texto no puede estar vacio.",
});

export const fosterHomeObservationQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const fosterHomeObservationListQueryValidation = Joi.object({
  foster_home_id: idSchema.required().messages({
    "any.required": "foster_home_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterHomeObservationCreateValidation = Joi.object({
  foster_home_id: idSchema.required().messages({
    "any.required": "foster_home_id es obligatorio.",
  }),
  texto: textSchema.required().messages({
    "any.required": "El texto es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

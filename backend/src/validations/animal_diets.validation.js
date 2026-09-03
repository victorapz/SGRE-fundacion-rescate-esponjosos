"use strict";

import Joi from "joi";

const string255Schema = Joi.string()
  .trim()
  .min(1)
  .max(255)
  .messages({
    "string.empty": "Este campo no puede estar vacio.",
    "string.base": "Este campo debe ser de tipo string.",
    "string.min": "Este campo debe tener como minimo 1 caracter.",
    "string.max": "Este campo debe tener como maximo 255 caracteres.",
  });

const animalIdSchema = Joi.number().integer().positive().messages({
  "number.base": "animal_id debe ser un numero.",
  "number.integer": "animal_id debe ser un numero entero.",
  "number.positive": "animal_id debe ser un numero positivo.",
});

export const animalDietsQueryValidation = Joi.object({
  id: Joi.number().integer().positive().messages({
    "number.base": "El id debe ser un numero.",
    "number.integer": "El id debe ser un numero entero.",
    "number.positive": "El id debe ser un numero positivo.",
  }),
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const animalDietsCreateValidation = Joi.object({
  marca_alimento: string255Schema.required().messages({
    "any.required": "La marca de alimento es obligatoria.",
  }),
  horario_alimentacion: string255Schema.required().messages({
    "any.required": "El horario de alimentacion es obligatorio.",
  }),
  notas: Joi.string().allow("").optional().messages({
    "string.base": "Las notas deben ser de tipo string.",
  }),
  animal_id: animalIdSchema.required().messages({
    "any.required": "animal_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const animalDietsUpdateBodyValidation = Joi.object({
  marca_alimento: string255Schema,
  horario_alimentacion: string255Schema,
  notas: Joi.string().allow(""),
  animal_id: animalIdSchema,
})
  .or("marca_alimento", "horario_alimentacion", "notas", "animal_id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

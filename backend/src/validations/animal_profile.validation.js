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

const textSchema = Joi.string().min(1).messages({
  "string.empty": "Este campo no puede estar vacio.",
  "string.base": "Este campo debe ser de tipo string.",
  "string.min": "Este campo debe tener como minimo 1 caracter.",
});

const animalIdSchema = Joi.number().integer().positive().messages({
  "number.base": "animal_id debe ser un numero.",
  "number.integer": "animal_id debe ser un numero entero.",
  "number.positive": "animal_id debe ser un numero positivo.",
});

export const animalProfileQueryValidation = Joi.object({
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

export const animalProfileCreateValidation = Joi.object({
  personalidad: string255Schema.required().messages({
    "any.required": "La personalidad es obligatoria.",
  }),
  gustos: string255Schema.required().messages({
    "any.required": "Los gustos son obligatorios.",
  }),
  disgustos: string255Schema.required().messages({
    "any.required": "Los disgustos son obligatorios.",
  }),
  historia: textSchema.required().messages({
    "any.required": "La historia es obligatoria.",
  }),
  cuidados_especiales: textSchema.required().messages({
    "any.required": "Los cuidados especiales son obligatorios.",
  }),
  animal_id: animalIdSchema.required().messages({
    "any.required": "animal_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const animalProfileUpdateBodyValidation = Joi.object({
  personalidad: string255Schema,
  gustos: string255Schema,
  disgustos: string255Schema,
  historia: textSchema,
  cuidados_especiales: textSchema,
  animal_id: animalIdSchema,
})
  .or(
    "personalidad",
    "gustos",
    "disgustos",
    "historia",
    "cuidados_especiales",
    "animal_id",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

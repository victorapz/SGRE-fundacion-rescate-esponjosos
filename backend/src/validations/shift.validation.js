"use strict";

import Joi from "joi";

const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const shiftCreateValidation = Joi.object({
  titulo: Joi.string()
    .required()
    .max(255)
    .trim()
    .messages({
      "string.empty": "El título es requerido",
      "string.max": "El título no puede exceder 255 caracteres",
      "any.required": "El título es obligatorio",
    }),

  fecha: Joi.string()
    .required()
    .pattern(datePattern)
    .messages({
      "string.pattern.base": "La fecha debe estar en formato YYYY-MM-DD",
      "any.required": "La fecha es obligatoria",
    }),

  hora_inicio: Joi.string()
    .required()
    .pattern(timePattern)
    .messages({
      "string.pattern.base": "La hora de inicio debe estar en formato HH:MM (24 horas)",
      "any.required": "La hora de inicio es obligatoria",
    }),

  hora_fin: Joi.string()
    .required()
    .pattern(timePattern)
    .messages({
      "string.pattern.base": "La hora de fin debe estar en formato HH:MM (24 horas)",
      "any.required": "La hora de fin es obligatoria",
    }),

  estado: Joi.boolean().messages({
    "boolean.base": "El estado debe ser booleano",
  }),

  cantidad_maxima: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": "La cantidad máxima debe ser un número",
      "number.integer": "La cantidad máxima debe ser un número entero",
      "number.positive": "La cantidad máxima debe ser mayor a 0",
      "any.required": "La cantidad máxima es obligatoria",
    }),
}).external(async (value) => {
  if (value.hora_inicio && value.hora_fin) {
    if (value.hora_inicio >= value.hora_fin) {
      throw new Error('La hora de inicio debe ser menor que la hora de fin');
    }
  }
});

export const shiftQueryValidation = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": "El id debe ser un número",
      "number.positive": "El id debe ser positivo",
      "any.required": "El id es obligatorio",
    }),
});

export const shiftUpdateBodyValidation = Joi.object({
  titulo: Joi.string()
    .max(255)
    .trim()
    .messages({
      "string.max": "El título no puede exceder 255 caracteres",
    }),

  fecha: Joi.string()
    .pattern(datePattern)
    .messages({
      "string.pattern.base": "La fecha debe estar en formato YYYY-MM-DD",
    }),

  hora_inicio: Joi.string()
    .pattern(timePattern)
    .messages({
      "string.pattern.base": "La hora de inicio debe estar en formato HH:MM (24 horas)",
    }),

  hora_fin: Joi.string()
    .pattern(timePattern)
    .messages({
      "string.pattern.base": "La hora de fin debe estar en formato HH:MM (24 horas)",
    }),

  estado: Joi.boolean().messages({
    "boolean.base": "El estado debe ser booleano",
  }),

  cantidad_maxima: Joi.number()
    .integer()
    .positive()
    .messages({
      "number.base": "La cantidad máxima debe ser un número",
      "number.integer": "La cantidad máxima debe ser un número entero",
      "number.positive": "La cantidad máxima debe ser mayor a 0",
    }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  })
  .external(async (value) => {
    if (value.hora_inicio && value.hora_fin) {
      if (value.hora_inicio >= value.hora_fin) {
        throw new Error('La hora de inicio debe ser menor que la hora de fin');
      }
    }
  });

"use strict";

import Joi from "joi";
import { EventCategory } from "../entities/event.entity.js";

const LEGACY_FIELDS = ["fecha", "hora_inicio", "hora_fin"];
const EVENT_CATEGORY_VALUES = Object.values(EventCategory);

function rejectLegacyFields(value, helpers) {
  const legacyField = LEGACY_FIELDS.find((field) => field in value);
  if (legacyField) {
    return helpers.error("event.legacyField", { field: legacyField });
  }
  return value;
}

function validateDateRange(value, helpers) {
  const { fecha_inicio, fecha_fin } = value;
  if (!fecha_inicio || !fecha_fin) {
    return value;
  }

  const startDate = new Date(fecha_inicio);
  const endDate = new Date(fecha_fin);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return value;
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return helpers.error("event.invalidRange");
  }

  return value;
}

const eventMessages = {
  "event.invalidRange": "La fecha de fin debe ser posterior a la fecha de inicio",
  "event.legacyField": "No se aceptan campos legacy como {#field}; usa fecha_inicio, fecha_fin y todo_el_dia",
  "any.only": "La categoria debe ser una de lascategoríaspermitidas",
};

const dateField = Joi.date().iso().messages({
  "date.base": "La fecha debe ser una fecha valida",
  "date.format": "La fecha debe estar en formato ISO",
  "date.isoDate": "La fecha debe estar en formato ISO",
});

export const eventCreateValidation = Joi.object({
  titulo: Joi.string()
    .required()
    .max(255)
    .trim()
    .messages({
      "string.empty": "El titulo es requerido",
      "string.max": "El titulo no puede exceder 255 caracteres",
      "any.required": "El titulo es obligatorio",
    }),
  descripcion: Joi.string()
    .required()
    .trim()
    .messages({
      "string.empty": "La descripcion es requerida",
      "any.required": "La descripcion es obligatoria",
    }),
  lugar: Joi.string()
    .required()
    .trim()
    .messages({
      "string.empty": "El lugar es requerido",
      "any.required": "El lugar es obligatorio",
    }),
  fecha_inicio: dateField.required().messages({
    "any.required": "La fecha de inicio es obligatoria",
  }),
  fecha_fin: dateField.required().messages({
    "any.required": "La fecha de fin es obligatoria",
  }),
  todo_el_dia: Joi.boolean().default(false).messages({
    "boolean.base": "todo_el_dia debe ser boolean",
  }),
  categoria: Joi.string()
    .valid(...EVENT_CATEGORY_VALUES)
    .default(EventCategory.COMUNITARIO)
    .messages({
      "string.base": "La categoria debe ser texto",
      "any.only": "La categoria debe ser una de lascategoríaspermitidas",
    }),
  activo: Joi.boolean().optional().messages({
    "boolean.base": "activo debe ser boolean",
  }),
})
  .custom(rejectLegacyFields)
  .custom(validateDateRange)
  .messages(eventMessages);

export const eventQueryValidation = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": "El id debe ser un numero",
      "number.positive": "El id debe ser positivo",
      "any.required": "El id es obligatorio",
    }),
});

export const eventUpdateBodyValidation = Joi.object({
  titulo: Joi.string()
    .max(255)
    .trim()
    .messages({
      "string.max": "El titulo no puede exceder 255 caracteres",
    }),
  descripcion: Joi.string().trim(),
  lugar: Joi.string().trim(),
  fecha_inicio: dateField,
  fecha_fin: dateField,
  todo_el_dia: Joi.boolean().messages({
    "boolean.base": "todo_el_dia debe ser boolean",
  }),
  categoria: Joi.string()
    .valid(...EVENT_CATEGORY_VALUES)
    .messages({
      "string.base": "La categoria debe ser texto",
      "any.only": "La categoria debe ser una de lascategoríaspermitidas",
    }),
  activo: Joi.boolean().messages({
    "boolean.base": "activo debe ser boolean",
  }),
})
  .min(1)
  .custom(rejectLegacyFields)
  .custom(validateDateRange)
  .messages({
    ...eventMessages,
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

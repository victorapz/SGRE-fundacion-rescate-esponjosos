"use strict";

import Joi from "joi";
import { Estado } from "../entities/foster_assignment.entity.js";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const dateSchema = Joi.string().isoDate().messages({
  "string.base": "La fecha debe ser de tipo string.",
  "string.isoDate": "La fecha debe tener formato YYYY-MM-DD.",
});

export const fosterAssignmentQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const fosterAssignmentListQueryValidation = Joi.object({
  hogar_temporal_id: idSchema.optional(),
  estado: Joi.string().valid(...Object.values(Estado)).optional().messages({
    "any.only": "El estado no es valido.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterAssignmentCreateValidation = Joi.object({
  animal_id: idSchema.required().messages({
    "any.required": "animal_id es obligatorio.",
  }),
  hogar_temporal_id: idSchema.required().messages({
    "any.required": "hogar_temporal_id es obligatorio.",
  }),
  fecha_inicio: dateSchema.required().messages({
    "any.required": "La fecha de inicio es obligatoria.",
  }),
  fecha_fin: Joi.forbidden().messages({
    "any.unknown": "fecha_fin no se permite al crear una asignacion activa.",
  }),
  estado: Joi.forbidden().messages({
    "any.unknown": "El estado inicial se define automaticamente.",
  }),
  motivo_termino: Joi.string().allow("").optional().messages({
    "string.base": "El motivo de termino debe ser de tipo string.",
  }),
  observaciones: Joi.string().allow("").optional().messages({
    "string.base": "Las observaciones deben ser de tipo string.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterAssignmentUpdateBodyValidation = Joi.object({
  fecha_fin: dateSchema.allow(null),
  estado: Joi.string().valid(...Object.values(Estado)).messages({
    "any.only": "El estado no es valido.",
  }),
  motivo_termino: Joi.string().allow(""),
  observaciones: Joi.string().allow(""),
})
  .or(
    "fecha_fin",
    "estado",
    "motivo_termino",
    "observaciones",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

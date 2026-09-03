"use strict";

import Joi from "joi";

const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(255)
  .pattern(/^[A-Za-zÀ-ÿÑñ' -]+$/)
  .messages({
    "string.empty": "Este campo no puede estar vacio.",
    "string.base": "Este campo debe ser de tipo string.",
    "string.min": "Este campo debe tener como minimo 2 caracteres.",
    "string.max": "Este campo debe tener como maximo 255 caracteres.",
    "string.pattern.base": "Este campo contiene caracteres no permitidos.",
  });

const emailSchema = Joi.string().trim().min(8).max(255).email().messages({
  "string.empty": "El correo electrónico no puede estar vacio.",
  "string.base": "El correo electrónico debe ser de tipo string.",
  "string.email": "El correo electrónico debe ser valido.",
  "string.min": "El correo electrónico debe tener como minimo 8 caracteres.",
  "string.max": "El correo electrónico debe tener como maximo 255 caracteres.",
});

const phoneSchema = Joi.string()
  .trim()
  .pattern(/^[0-9+\-\s()]{8,20}$/)
  .messages({
    "string.empty": "El telefono no puede estar vacio.",
    "string.base": "El telefono debe ser de tipo string.",
    "string.pattern.base": "Formato telefono invalido.",
  });

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const clinicIdsSchema = Joi.array()
  .items(idSchema)
  .unique()
  .optional()
  .messages({
    "array.base": "clinic_ids debe ser un arreglo.",
  });

export const veterinarianQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const veterinarianListQueryValidation = Joi.object({
  activo: Joi.boolean().optional(),
  clinic_id: idSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const veterinarianCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  apellido: nameSchema.required().messages({
    "any.required": "El apellido es obligatorio.",
  }),
  email: emailSchema.required().messages({
    "any.required": "El correo electrónico es obligatorio.",
  }),
  telefono: phoneSchema.required().messages({
    "any.required": "El telefono es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
  clinic_id: idSchema.allow(null).optional(),
  clinic_ids: clinicIdsSchema,
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const veterinarianUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  apellido: nameSchema,
  email: emailSchema,
  telefono: phoneSchema,
  activo: Joi.boolean(),
  clinic_id: idSchema.allow(null),
  clinic_ids: clinicIdsSchema,
})
  .or("nombre", "apellido", "email", "telefono", "activo", "clinic_id", "clinic_ids")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

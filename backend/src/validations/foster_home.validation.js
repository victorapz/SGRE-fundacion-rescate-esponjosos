"use strict";

import Joi from "joi";
import { allowedAnimalBodySchema } from "./foster_home_allowed_animal.validation.js";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const associatedUsersSchema = Joi.array()
  .items(idSchema)
  .min(1)
  .unique()
  .messages({
    "array.base": "usuarios_asociados debe ser una lista.",
    "array.min": "Debe existir al menos un usuario asociado.",
    "array.unique": "No se puede asociar el mismo usuario dos veces al hogar temporal.",
  });

function validateResponsibleInAssociatedUsers(value, helpers) {
  if (
    value.responsable_usuario_id !== undefined
    && Array.isArray(value.usuarios_asociados)
    && !value.usuarios_asociados.includes(value.responsable_usuario_id)
  ) {
    return helpers.message(
      "responsable_usuario_id debe estar incluido dentro de usuarios_asociados.",
    );
  }

  return value;
}

export const fosterHomeQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const fosterHomeCreateValidation = Joi.object({
  observaciones: Joi.string().allow("").optional().messages({
    "string.base": "Las observaciones deben ser de tipo string.",
  }),
  activo: Joi.boolean().optional(),
  usuarios_asociados: associatedUsersSchema.required().messages({
    "any.required": "usuarios_asociados es obligatorio.",
  }),
  responsable_usuario_id: idSchema.required().messages({
    "any.required": "responsable_usuario_id es obligatorio.",
  }),
  allowed_animals: Joi.array().items(allowedAnimalBodySchema).optional().messages({
    "array.base": "allowed_animals debe ser una lista.",
  }),
})
  .custom(validateResponsibleInAssociatedUsers)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fosterHomeUpdateBodyValidation = Joi.object({
  observaciones: Joi.string().allow(""),
  activo: Joi.boolean(),
  usuarios_asociados: associatedUsersSchema,
  responsable_usuario_id: idSchema,
  allowed_animals: Joi.forbidden().messages({
    "any.unknown": "allowed_animals debe administrarse por su recurso dedicado.",
  }),
})
  .or("observaciones", "activo", "usuarios_asociados", "responsable_usuario_id")
  .custom(validateResponsibleInAssociatedUsers)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

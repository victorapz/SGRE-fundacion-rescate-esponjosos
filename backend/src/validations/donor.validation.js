"use strict";

import Joi from "joi";
import { idSchema, optionalTextSchema, requiredTextSchema } from "./inventory.shared.validation.js";

const donorNameSchema = requiredTextSchema("El nombre del donante", 255).pattern(
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/,
  "nombre valido",
).messages({
  "string.pattern.name":
    "El nombre del donante solo puede contener letras, espacios, guiones y apostrofes.",
});

const donorOptionalNameSchema = optionalTextSchema("El apellido del donante", 255).pattern(
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/,
  "apellido valido",
).messages({
  "string.pattern.name":
    "El apellido del donante solo puede contener letras, espacios, guiones y apostrofes.",
});

const emailSchema = Joi.string().trim().email().allow(null, "").messages({
  "string.base": "El correo del donante debe ser de tipo string.",
  "string.email": "El correo del donante debe ser valido.",
});

export const donorQueryValidation = Joi.object({
  donante_id: idSchema("donante_id").required().messages({
    "any.required": "donante_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donorCreateValidation = Joi.object({
  nombre: donorNameSchema.required().messages({
    "any.required": "El nombre del donante es obligatorio.",
  }),
  apellido: donorOptionalNameSchema.optional(),
  email: emailSchema.optional(),
  telefono: optionalTextSchema("El telefono del donante", 50).optional(),
  usuario_instagram: optionalTextSchema("El usuario de Instagram", 255).optional(),
  direccion: optionalTextSchema("La direccion", 5000).optional(),
  observaciones: optionalTextSchema("Las observaciones", 5000).optional(),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donorUpdateBodyValidation = Joi.object({
  nombre: donorNameSchema,
  apellido: donorOptionalNameSchema,
  email: emailSchema,
  telefono: optionalTextSchema("El telefono del donante", 50),
  usuario_instagram: optionalTextSchema("El usuario de Instagram", 255),
  direccion: optionalTextSchema("La direccion", 5000),
  observaciones: optionalTextSchema("Las observaciones", 5000),
  activo: Joi.boolean(),
})
  .or(
    "nombre",
    "apellido",
    "email",
    "telefono",
    "usuario_instagram",
    "direccion",
    "observaciones",
    "activo",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

"use strict";

import Joi from "joi";
import { nestedLocationPayloadValidation } from "./location.validation.js";
import { confirmPasswordSchema, passwordSchema } from "./password.shared.js";

const PASSWORD_FIELD = "contrase\u00f1a";
const ALT_PASSWORD_FIELD = "contraseÃƒÆ’Ã‚Â±a";
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const rutPattern = /^(?:(?:[1-9]\d?|[1-3]\d)(?:\.\d{3}){2}|[1-9]\d{6,7}|40000000|40\.000\.000)-[\dkK]$/;

const domainEmailValidator = (value, helper) => {
  const normalized = value.toLowerCase();

  if (!normalized.endsWith(".com") && !normalized.endsWith(".cl")) {
    return helper.message(
      "El correo electrónico debe tener una extension de dominio valida (.com o .cl)",
    );
  }

  return normalized;
};

const emailSchema = Joi.string()
  .trim()
  .min(8)
  .max(100)
  .email()
  .custom(domainEmailValidator, "Validacion dominio email")
  .messages({
    "string.empty": "El correo electrónico no puede estar vacio.",
    "string.base": "El correo electrónico debe ser de tipo string.",
    "string.email": "El correo electrónico debe ser valido.",
    "string.min": "El correo electrónico debe tener como minimo 8 caracteres.",
    "string.max": "El correo electrónico debe tener como maximo 100 caracteres.",
  });

const rutSchema = Joi.string()
  .trim()
  .min(9)
  .max(12)
  .pattern(rutPattern)
  .messages({
    "string.empty": "El rut no puede estar vacio.",
    "string.base": "El rut debe ser de tipo string.",
    "string.min": "El rut debe tener como minimo 9 caracteres.",
    "string.max": "El rut debe tener como maximo 12 caracteres.",
    "string.pattern.base": "Formato rut invalido, debe ser xx.xxx.xxx-x o xxxxxxxx-x.",
  });

const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(60)
  .pattern(PERSON_NAME_PATTERN)
  .messages({
    "string.empty": "Este campo no puede estar vacio.",
    "string.base": "Este campo debe ser de tipo string.",
    "string.min": "Este campo debe tener como minimo 2 caracteres.",
    "string.max": "Este campo debe tener como maximo 60 caracteres.",
    "string.pattern.base":
      "Este campo solo puede contener letras, espacios simples, guiones y apostrofes entre palabras.",
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

const idArraySchema = Joi.array()
  .items(idSchema)
  .min(1)
  .unique()
  .messages({
    "array.base": "Debe ser un arreglo.",
    "array.min": "Debe contener al menos un elemento.",
    "array.unique": "No se permiten ids duplicados.",
  });

export const userQueryValidation = Joi.object({
  id: idSchema,
  email: emailSchema,
  rut: rutSchema,
})
  .or("id", "email", "rut")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un parametro: id, email o rut.",
  });

export const userCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  apellido: nameSchema.required().messages({
    "any.required": "El apellido es obligatorio.",
  }),
  email: emailSchema.required().messages({
    "any.required": "El correo electrónico es obligatorio.",
  }),
  [PASSWORD_FIELD]: passwordSchema,
  [ALT_PASSWORD_FIELD]: passwordSchema,
  rut: rutSchema.required().messages({
    "any.required": "El rut es obligatorio.",
  }),
  telefono: phoneSchema.required().messages({
    "any.required": "El telefono es obligatorio.",
  }),
  activo: Joi.boolean().optional(),
  area_ids: idArraySchema.required().messages({
    "array.base": "Las areas seleccionadas deben enviarse como un arreglo.",
    "array.min": "Debe asignar al menos un area al usuario.",
    "array.unique": "No se pueden repetir areas seleccionadas.",
    "any.required": "Debe asignar al menos un area al usuario.",
  }),
  role_ids: idArraySchema.required().messages({
    "array.base": "Los roles seleccionados deben enviarse como un arreglo.",
    "array.min": "Debe asignar al menos un rol al usuario.",
    "array.unique": "No se pueden repetir roles seleccionados.",
    "any.required": "Debe asignar al menos un rol al usuario.",
  }),
  location: nestedLocationPayloadValidation.required().messages({
    "any.required": "location es obligatorio.",
  }),
})
  .or(PASSWORD_FIELD, ALT_PASSWORD_FIELD)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "La contrasena es obligatoria.",
  });

export const userUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  apellido: nameSchema,
  email: emailSchema,
  rut: rutSchema,
  telefono: phoneSchema,
  activo: Joi.boolean(),
  area_ids: idArraySchema.messages({
    "array.base": "Las areas seleccionadas deben enviarse como un arreglo.",
    "array.min": "Debe asignar al menos un area al usuario.",
    "array.unique": "No se pueden repetir areas seleccionadas.",
  }),
  role_ids: idArraySchema.messages({
    "array.base": "Los roles seleccionados deben enviarse como un arreglo.",
    "array.min": "Debe asignar al menos un rol al usuario.",
    "array.unique": "No se pueden repetir roles seleccionados.",
  }),
  location: nestedLocationPayloadValidation,
})
  .or(
    "nombre",
    "apellido",
    "email",
    "rut",
    "telefono",
    "activo",
    "area_ids",
    "role_ids",
    "location",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

export const userPasswordResetBodyValidation = Joi.object({
  new_password: passwordSchema.required().messages({
    "any.required": "Debes ingresar una nueva contrasena.",
  }),
  confirm_password: confirmPasswordSchema,
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export {
  emailSchema,
  nameSchema,
  phoneSchema,
  rutSchema,
};

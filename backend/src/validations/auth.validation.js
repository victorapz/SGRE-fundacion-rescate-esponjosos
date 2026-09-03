"use strict";

import Joi from "joi";
import { confirmPasswordSchema, passwordSchema } from "./password.shared.js";
import { locationUpdateBodyValidation } from "./location.validation.js";
import { emailSchema, nameSchema, phoneSchema } from "./user.validation.js";

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const authValidation = {
  validate(payload = {}) {
    const email = normalize(payload.email);
    const password = normalize(payload.password);

    if (!email || !password) {
      return {
        error: {
          message: "Email y password son obligatorios",
        },
      };
    }

    return { error: null };
  },
};

export const myProfileUpdateValidation = Joi.object({
  nombre: nameSchema,
  apellido: nameSchema,
  telefono: phoneSchema,
  email: emailSchema,
  email_confirm: emailSchema,
  current_password: passwordSchema,
  location: locationUpdateBodyValidation,
})
  .or("nombre", "apellido", "telefono", "email", "location")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes enviar al menos un dato personal para actualizar.",
  });

export const myPasswordChangeValidation = Joi.object({
  current_password: passwordSchema.required().messages({
    "any.required": "Debes ingresar tu contrasena actual.",
  }),
  new_password: passwordSchema.required().messages({
    "any.required": "Debes ingresar una nueva contrasena.",
  }),
  confirm_password: confirmPasswordSchema,
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

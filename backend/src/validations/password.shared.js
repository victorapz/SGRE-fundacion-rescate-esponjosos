"use strict";

import Joi from "joi";

export const PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  maxLength: 72,
  pattern: /^[a-zA-Z0-9]+$/,
  hint: "Debe tener entre 8 y 72 caracteres y solo puede contener letras y numeros.",
});

export const passwordSchema = Joi.string()
  .min(PASSWORD_POLICY.minLength)
  .max(PASSWORD_POLICY.maxLength)
  .pattern(PASSWORD_POLICY.pattern)
  .messages({
    "string.empty": "La contrasena no puede estar vacia.",
    "string.base": "La contrasena debe ser de tipo string.",
    "string.min": `La contrasena debe tener como minimo ${PASSWORD_POLICY.minLength} caracteres.`,
    "string.max": `La contrasena debe tener como maximo ${PASSWORD_POLICY.maxLength} caracteres.`,
    "string.pattern.base": "La contrasena solo puede contener letras y numeros.",
  });

export const confirmPasswordSchema = Joi.string()
  .required()
  .valid(Joi.ref("new_password"))
  .messages({
    "any.only": "Las contrasenas no coinciden.",
    "any.required": "Debes confirmar la nueva contrasena.",
    "string.empty": "Debes confirmar la nueva contrasena.",
  });

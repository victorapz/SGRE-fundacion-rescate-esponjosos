"use strict";

import Joi from "joi";
import { idSchema, requiredTextSchema } from "./inventory.shared.validation.js";

const providerTypeValues = ["PAYPAL", "MANUAL", "TRANSFERENCIA", "EFECTIVO", "OTRO"];
const FORBIDDEN_PROVIDER_METADATA_KEYS = [
  "client_secret",
  "access_token",
  "password",
  "signature",
];

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const claveSchema = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z0-9_]+$/)
  .max(120)
  .messages({
    "string.base": "La clave debe ser de tipo string.",
    "string.empty": "La clave no puede estar vacia.",
    "string.max": "La clave debe tener como maximo 120 caracteres.",
    "string.pattern.base": "La clave solo puede contener letras mayusculas, numeros y guion bajo.",
  });

function containsForbiddenProviderMetadataKey(value) {
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (FORBIDDEN_PROVIDER_METADATA_KEYS.includes(normalizedKey)) {
      return true;
    }

    if (Array.isArray(nestedValue)) {
      return nestedValue.some((item) => containsForbiddenProviderMetadataKey(item));
    }

    return containsForbiddenProviderMetadataKey(nestedValue);
  });
}

const metadataPublicaSchema = Joi.object()
  .unknown(true)
  .allow(null)
  .custom((value, helpers) => {
    if (containsForbiddenProviderMetadataKey(value)) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .messages({
    "any.invalid":
      "metadata_publica no puede incluir client_secret, access_token, password ni signature.",
  });

export const paymentProviderQueryValidation = Joi.object({
  proveedor_pago_id: idSchema("proveedor_pago_id").required().messages({
    "any.required": "proveedor_pago_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentProviderListValidation = Joi.object({
  ...paginationSchema,
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...providerTypeValues)
    .optional(),
  activo: Joi.boolean().optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentProviderCreateValidation = Joi.object({
  clave: claveSchema.required().messages({
    "any.required": "La clave es obligatoria.",
  }),
  nombre: requiredTextSchema("El nombre", 255).required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...providerTypeValues)
    .required()
    .messages({
      "any.required": "El tipo es obligatorio.",
      "any.only": `El tipo debe ser uno de: ${providerTypeValues.join(", ")}.`,
    }),
  activo: Joi.boolean().optional(),
  metadata_publica: metadataPublicaSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentProviderUpdateBodyValidation = Joi.object({
  clave: claveSchema.optional(),
  nombre: requiredTextSchema("El nombre", 255).optional(),
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...providerTypeValues)
    .optional(),
  activo: Joi.boolean().optional(),
  metadata_publica: metadataPublicaSchema.optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debes enviar al menos un campo para actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

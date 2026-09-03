"use strict";

import Joi from "joi";
import { PAYPAL_CURRENCY } from "../../config/configEnv.js";
import { moneyAmountSchema } from "../financial.shared.validation.js";
import {
  idSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "../inventory.shared.validation.js";

const ALLOWED_CURRENCY = String(PAYPAL_CURRENCY || "USD").trim().toUpperCase();
const FORBIDDEN_METADATA_KEYS = [
  "authorization",
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "client_secret",
  "password",
  "signature",
];

function containsForbiddenMetadataKey(value) {
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.includes(normalizedKey)) {
      return true;
    }

    if (Array.isArray(nestedValue)) {
      return nestedValue.some((item) => containsForbiddenMetadataKey(item));
    }

    return containsForbiddenMetadataKey(nestedValue);
  });
}

const safeMetadataSchema = Joi.object()
  .unknown(true)
  .allow(null)
  .custom((value, helpers) => {
    if (containsForbiddenMetadataKey(value)) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .messages({
    "any.invalid":
      "metadata no puede incluir authorization, access_token, token, secret, client_secret, password ni signature.",
  });

const donorSchema = Joi.object({
  nombre: optionalTextSchema("El nombre del donante", 120).optional(),
  apellido: optionalTextSchema("El apellido del donante", 120).optional(),
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .allow(null, "")
    .optional()
    .messages({
      "string.email": "El email del donante debe ser valido.",
      "string.max": "El email del donante debe tener como maximo 255 caracteres.",
    }),
  telefono: Joi.string()
    .trim()
    .pattern(/^[+\d][\d\s().-]{5,24}$/)
    .allow(null, "")
    .optional()
    .messages({
      "string.pattern.base": "El telefono del donante tiene un formato invalido.",
    }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales dentro de donor.",
  });

function hasMeaningfulDonorPayload(donor) {
  if (!donor || typeof donor !== "object") return false;

  return ["nombre", "apellido", "email", "telefono"].some((key) => {
    const value = donor[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

export const paypalDonationCreateOrderValidation = Joi.object({
  monto_bruto: moneyAmountSchema("El monto bruto")
    .greater(0)
    .required()
    .messages({
      "any.required": "monto_bruto es obligatorio.",
      "number.greater": "monto_bruto debe ser mayor a 0.",
    }),
  moneda: Joi.string()
    .trim()
    .uppercase()
    .valid(ALLOWED_CURRENCY)
    .default(ALLOWED_CURRENCY)
    .optional()
    .messages({
      "any.only": `La moneda debe ser ${ALLOWED_CURRENCY} para PayPal en esta fase.`,
    }),
  anonymous: Joi.boolean()
    .strict()
    .optional()
    .default(false)
    .messages({
      "boolean.base": "anonymous debe ser un valor booleano.",
    }),
  consentimiento_datos: Joi.boolean().optional().default(false),
  donor: donorSchema.allow(null).optional(),
  descripcion: optionalTextSchema("La descripcion", 127).optional(),
  metadata: safeMetadataSchema.optional(),
})
  .custom((value, helpers) => {
    const anonymous = Boolean(value.anonymous);
    const hasDonor = hasMeaningfulDonorPayload(value.donor);

    if (anonymous && hasDonor) {
      return helpers.error("paypalDonation.anonymousWithDonor");
    }

    return value;
  })
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "paypalDonation.anonymousWithDonor": "No puedes enviar donor cuando anonymous=true.",
  });

export const paypalDonationCaptureOrderValidation = Joi.object({
  paypal_order_id: requiredTextSchema("paypal_order_id", 255).optional(),
  orden_pago_id: idSchema("orden_pago_id").optional(),
})
  .or("paypal_order_id", "orden_pago_id")
  .unknown(false)
  .messages({
    "object.missing": "Debes enviar paypal_order_id, orden_pago_id o ambos.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

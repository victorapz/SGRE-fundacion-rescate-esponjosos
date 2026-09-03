"use strict";

import Joi from "joi";
import { currencySchema, moneyAmountSchema } from "./financial.shared.validation.js";
import {
  idSchema,
  optionalIsoDateSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const DONATION_VISIBLE_STATUS_VALUES = [
  "PENDIENTE",
  "CAPTURADA",
  "FALLIDA",
  "CANCELADA",
  "EXPIRADA",
  "REEMBOLSADA_PARCIAL",
  "REEMBOLSADA_TOTAL",
  "REVERTIDA",
];

const DONATION_REFUND_STATUS_VALUES = ["NONE", "PARTIAL", "FULL", "REVERSED"];
const DONATION_SORT_BY_VALUES = [
  "captured_at",
  "created_at",
  "gross_amount",
  "fee_amount",
  "net_amount",
  "refunded_amount",
  "donor_name",
];
const SORT_ORDER_VALUES = ["asc", "desc"];

export const accountingDonationListValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
  status: Joi.string()
    .trim()
    .uppercase()
    .valid(...DONATION_VISIBLE_STATUS_VALUES)
    .optional(),
  anonymous: Joi.boolean().optional(),
  date_from: optionalIsoDateSchema("La date_from").optional(),
  date_to: optionalIsoDateSchema("La date_to").optional(),
  provider: idSchema("provider").optional(),
  currency: currencySchema("La currency").optional(),
  refund_status: Joi.string()
    .trim()
    .uppercase()
    .valid(...DONATION_REFUND_STATUS_VALUES)
    .optional(),
  sort_by: Joi.string()
    .trim()
    .lowercase()
    .valid(...DONATION_SORT_BY_VALUES)
    .optional(),
  sort_order: Joi.string()
    .trim()
    .lowercase()
    .valid(...SORT_ORDER_VALUES)
    .optional(),
})
  .custom((value, helpers) => {
    if (
      value.date_from
      && value.date_to
      && String(value.date_from) > String(value.date_to)
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .unknown(false)
  .messages({
    "any.invalid": "date_from no puede ser mayor que date_to.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const accountingDonationRefundParamsValidation = Joi.object({
  paymentOrderId: idSchema("paymentOrderId").required(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en la ruta.",
  });

export const accountingDonationRefundBodyValidation = Joi.object({
  monto: moneyAmountSchema("El monto")
    .greater(0)
    .required()
    .messages({
      "any.required": "monto es obligatorio.",
      "number.greater": "monto debe ser mayor a 0.",
    }),
  motivo: requiredTextSchema("motivo", 255)
    .min(3)
    .required()
    .messages({
      "string.min": "motivo debe tener al menos 3 caracteres.",
    }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

"use strict";

import Joi from "joi";
import {
  currencySchema,
  moneyAmountSchema,
} from "./financial.shared.validation.js";
import {
  idSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

const payableStateValues = [
  "PENDIENTE",
  "PAGADA_PARCIAL",
  "PAGADA",
  "VENCIDA",
  "ANULADA",
  "CONDONADA",
];

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const positiveMoneySchema = (label) =>
  moneyAmountSchema(label).greater(0).messages({
    "number.greater": `${label} debe ser mayor a 0.`,
  });

export const payableAccountQueryValidation = Joi.object({
  cuenta_por_pagar_id: idSchema("cuenta_por_pagar_id").required().messages({
    "any.required": "cuenta_por_pagar_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const payableAccountListValidation = Joi.object({
  ...paginationSchema,
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...payableStateValues)
    .optional(),
  origen_tipo: optionalTextSchema("El origen_tipo", 120).optional(),
  proveedor_tipo: optionalTextSchema("El proveedor_tipo", 120).optional(),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").optional(),
  moneda: currencySchema("La moneda").optional(),
  fecha_desde: optionalIsoDateSchema("La fecha_desde").optional(),
  fecha_hasta: optionalIsoDateSchema("La fecha_hasta").optional(),
  vencidas: Joi.boolean().optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const payableAccountCreateValidation = Joi.object({
  origen_tipo: optionalTextSchema("El origen_tipo", 120).optional(),
  origen_id: Joi.number().integer().positive().allow(null).optional(),
  proveedor_tipo: optionalTextSchema("El proveedor_tipo", 120).optional(),
  proveedor_id: Joi.number().integer().positive().allow(null).optional(),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").allow(null).optional(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  moneda: currencySchema("La moneda").optional(),
  monto_total: positiveMoneySchema("El monto total").required().messages({
    "any.required": "El monto total es obligatorio.",
  }),
  fecha_emision: isoDateSchema("La fecha de emision").required().messages({
    "any.required": "La fecha de emision es obligatoria.",
  }),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento").optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const payableAccountUpdateBodyValidation = Joi.object({
  origen_tipo: optionalTextSchema("El origen_tipo", 120).optional(),
  origen_id: Joi.number().integer().positive().allow(null).optional(),
  proveedor_tipo: optionalTextSchema("El proveedor_tipo", 120).optional(),
  proveedor_id: Joi.number().integer().positive().allow(null).optional(),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").allow(null).optional(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  moneda: currencySchema("La moneda").optional(),
  monto_total: positiveMoneySchema("El monto total").optional(),
  fecha_emision: optionalIsoDateSchema("La fecha de emision").optional(),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento").optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debes enviar al menos un campo para actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const payableAccountCancelBodyValidation = Joi.object({
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid("ANULADA", "CONDONADA")
    .required()
    .messages({
      "any.required": "El estado es obligatorio.",
      "any.only": "El estado debe ser ANULADA o CONDONADA.",
    }),
  observacion: optionalTextSchema("La observacion", 5000).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

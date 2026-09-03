"use strict";

import Joi from "joi";
import {
  currencySchema,
  moneyAmountSchema,
} from "./financial.shared.validation.js";
import {
  idSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

const orderPurposeValues = ["DONACION_UNICA", "APADRINAMIENTO", "SUSCRIPCION", "OTRO"];
const orderStateValues = [
  "CREADA",
  "APROBADA",
  "CAPTURADA",
  "CANCELADA",
  "EXPIRADA",
  "FALLIDA",
  "REEMBOLSADA",
];

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const positiveMoneySchema = (label) =>
  moneyAmountSchema(label).greater(0).messages({
    "number.greater": `${label} debe ser mayor a 0.`,
  });

export const paymentOrderQueryValidation = Joi.object({
  orden_pago_id: idSchema("orden_pago_id").required().messages({
    "any.required": "orden_pago_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentOrderListValidation = Joi.object({
  ...paginationSchema,
  proveedor_pago_id: idSchema("proveedor_pago_id").optional(),
  donante_id: idSchema("donante_id").optional(),
  proposito: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderPurposeValues)
    .optional(),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderStateValues)
    .optional(),
  moneda: currencySchema("La moneda").optional(),
  fecha_desde: optionalIsoDateSchema("La fecha_desde").optional(),
  fecha_hasta: optionalIsoDateSchema("La fecha_hasta").optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentOrderCreateValidation = Joi.object({
  proveedor_pago_id: idSchema("proveedor_pago_id").required().messages({
    "any.required": "proveedor_pago_id es obligatorio.",
  }),
  proveedor_orden_id: optionalTextSchema("El proveedor_orden_id", 255).optional(),
  donante_id: idSchema("donante_id").allow(null).optional(),
  proposito: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderPurposeValues)
    .required()
    .messages({
      "any.required": "El proposito es obligatorio.",
      "any.only": `El proposito debe ser uno de: ${orderPurposeValues.join(", ")}.`,
    }),
  moneda: currencySchema("La moneda").optional(),
  monto_bruto: positiveMoneySchema("El monto bruto").required().messages({
    "any.required": "El monto bruto es obligatorio.",
  }),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderStateValues)
    .optional(),
  approval_url: optionalTextSchema("La approval_url", 5000).optional(),
  fecha_expiracion: optionalIsoDateSchema("La fecha_expiracion").optional(),
  capturada_en: optionalIsoDateSchema("La fecha capturada_en").optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentOrderUpdateBodyValidation = Joi.object({
  proveedor_pago_id: idSchema("proveedor_pago_id").allow(null).optional(),
  proveedor_orden_id: optionalTextSchema("El proveedor_orden_id", 255).optional(),
  donante_id: idSchema("donante_id").allow(null).optional(),
  proposito: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderPurposeValues)
    .optional(),
  moneda: currencySchema("La moneda").optional(),
  monto_bruto: positiveMoneySchema("El monto bruto").optional(),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...orderStateValues)
    .optional(),
  approval_url: optionalTextSchema("La approval_url", 5000).optional(),
  fecha_expiracion: optionalIsoDateSchema("La fecha_expiracion").optional(),
  capturada_en: optionalIsoDateSchema("La fecha capturada_en").optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debes enviar al menos un campo para actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const paymentOrderCancelBodyValidation = Joi.object({
  motivo: optionalTextSchema("El motivo", 5000).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

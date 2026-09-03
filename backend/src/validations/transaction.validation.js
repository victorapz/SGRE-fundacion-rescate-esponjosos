"use strict";

import Joi from "joi";
import {
  currencySchema,
  financialNoteSchema,
  moneyAmountSchema,
} from "./financial.shared.validation.js";
import {
  idSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

const transactionTypeValues = ["INGRESO", "EGRESO", "REEMBOLSO", "AJUSTE"];
const transactionStateValues = [
  "CONFIRMADA",
  "ANULADA",
  "COMPLETADA",
  "CANCELADA",
  "FALLIDA",
  "PENDIENTE",
];

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const positiveMoneySchema = (label) =>
  moneyAmountSchema(label).greater(0).messages({
    "number.greater": `${label} debe ser mayor a 0.`,
  });

export const transactionQueryValidation = Joi.object({
  transaccion_id: idSchema("transaccion_id").required().messages({
    "any.required": "transaccion_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionListValidation = Joi.object({
  ...paginationSchema,
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...transactionTypeValues)
    .optional(),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").optional(),
  proveedor_pago_id: idSchema("proveedor_pago_id").optional(),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...transactionStateValues)
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

export const transactionCreateValidation = Joi.object({
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...transactionTypeValues)
    .required()
    .messages({
      "any.required": "El tipo es obligatorio.",
      "any.only": `El tipo debe ser uno de: ${transactionTypeValues.join(", ")}.`,
    }),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").allow(null).optional(),
  proveedor_pago_id: idSchema("proveedor_pago_id").allow(null).optional(),
  orden_pago_id: idSchema("orden_pago_id").allow(null).optional(),
  donante_id: idSchema("donante_id").allow(null).optional(),
  cuenta_por_pagar_id: idSchema("cuenta_por_pagar_id").allow(null).optional(),
  descripcion: financialNoteSchema("La descripcion", 5000).optional(),
  moneda: currencySchema("La moneda").optional(),
  monto_bruto: positiveMoneySchema("El monto bruto").required().messages({
    "any.required": "El monto bruto es obligatorio.",
  }),
  monto_fee: moneyAmountSchema("El monto fee").optional(),
  fecha_transaccion: optionalIsoDateSchema("La fecha de transaccion").optional(),
  origen_tipo: optionalTextSchema("El origen_tipo", 120).optional(),
  origen_id: Joi.number().integer().positive().allow(null).optional(),
  referencia_externa: optionalTextSchema("La referencia externa", 255).optional(),
  idempotencia_key: optionalTextSchema("La llave de idempotencia", 255).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionUpdateBodyValidation = Joi.object({
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...transactionTypeValues)
    .optional(),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").allow(null).optional(),
  proveedor_pago_id: idSchema("proveedor_pago_id").allow(null).optional(),
  orden_pago_id: idSchema("orden_pago_id").allow(null).optional(),
  donante_id: idSchema("donante_id").allow(null).optional(),
  cuenta_por_pagar_id: idSchema("cuenta_por_pagar_id").allow(null).optional(),
  descripcion: financialNoteSchema("La descripcion", 5000).optional(),
  moneda: currencySchema("La moneda").optional(),
  monto_bruto: positiveMoneySchema("El monto bruto").optional(),
  monto_fee: moneyAmountSchema("El monto fee").optional(),
  fecha_transaccion: optionalIsoDateSchema("La fecha de transaccion").optional(),
  origen_tipo: optionalTextSchema("El origen_tipo", 120).optional(),
  origen_id: Joi.number().integer().positive().allow(null).optional(),
  referencia_externa: optionalTextSchema("La referencia externa", 255).optional(),
  idempotencia_key: optionalTextSchema("La llave de idempotencia", 255).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debes enviar al menos un campo para actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transactionCancelBodyValidation = Joi.object({
  motivo: financialNoteSchema("El motivo", 5000).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

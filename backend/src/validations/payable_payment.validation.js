"use strict";

import Joi from "joi";
import {
  currencySchema,
  moneyAmountSchema,
} from "./financial.shared.validation.js";
import {
  idSchema,
  isoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

const positiveMoneySchema = (label) =>
  moneyAmountSchema(label).greater(0).messages({
    "number.greater": `${label} debe ser mayor a 0.`,
  });

export const payablePaymentParamsValidation = Joi.object({
  cuenta_por_pagar_id: idSchema("cuenta_por_pagar_id").required().messages({
    "any.required": "cuenta_por_pagar_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const payablePaymentCreateValidation = Joi.object({
  transaccion_id: idSchema("transaccion_id").allow(null).optional(),
  monto_aplicado: positiveMoneySchema("El monto aplicado").required().messages({
    "any.required": "El monto aplicado es obligatorio.",
  }),
  monto_fee: moneyAmountSchema("El monto fee").optional(),
  fecha_pago: isoDateSchema("La fecha de pago").required().messages({
    "any.required": "La fecha de pago es obligatoria.",
  }),
  categoria_transaccion_id: idSchema("categoria_transaccion_id").allow(null).optional(),
  proveedor_pago_id: idSchema("proveedor_pago_id").allow(null).optional(),
  donante_id: idSchema("donante_id").allow(null).optional(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  moneda: currencySchema("La moneda").optional(),
  referencia_externa: optionalTextSchema("La referencia externa", 255).optional(),
  idempotencia_key: optionalTextSchema("La llave de idempotencia", 255).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

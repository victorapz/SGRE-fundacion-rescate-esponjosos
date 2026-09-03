"use strict";

import Joi from "joi";
import { idSchema, optionalIsoDateSchema } from "./inventory.shared.validation.js";

const webhookStateValues = ["RECIBIDO", "VERIFICADO", "PROCESADO", "IGNORADO", "ERROR"];

export const webhookLogQueryValidation = Joi.object({
  webhook_log_id: idSchema("webhook_log_id").required().messages({
    "any.required": "webhook_log_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const webhookLogListValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  proveedor_pago_id: idSchema("proveedor_pago_id").optional(),
  evento_tipo: Joi.string().trim().max(255).allow("", null).optional(),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...webhookStateValues)
    .optional(),
  fecha_desde: optionalIsoDateSchema("La fecha_desde").optional(),
  fecha_hasta: optionalIsoDateSchema("La fecha_hasta").optional(),
  search: Joi.string().trim().max(255).allow("", null).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

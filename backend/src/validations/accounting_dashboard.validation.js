"use strict";

import Joi from "joi";
import { currencySchema } from "./financial.shared.validation.js";
import { optionalIsoDateSchema } from "./inventory.shared.validation.js";

export const accountingDashboardQueryValidation = Joi.object({
  fecha_desde: optionalIsoDateSchema("La fecha_desde").optional(),
  fecha_hasta: optionalIsoDateSchema("La fecha_hasta").optional(),
  moneda: currencySchema("La moneda").optional(),
  latest_limit: Joi.number().integer().min(1).max(20).optional(),
  upcoming_limit: Joi.number().integer().min(1).max(20).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

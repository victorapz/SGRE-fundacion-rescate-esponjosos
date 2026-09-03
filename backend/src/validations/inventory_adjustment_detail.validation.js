"use strict";

import Joi from "joi";
import {
  idSchema,
  nonNegativeNumberSchema,
} from "./inventory.shared.validation.js";

const tipoAjusteSchema = Joi.string()
  .valid("POSITIVO", "NEGATIVO")
  .messages({
    "any.only": "El tipo de ajuste no es valido.",
    "string.base": "El tipo de ajuste debe ser de tipo string.",
  });

export const inventoryAdjustmentDetailQueryValidation = Joi.object({
  ajuste_detalle_id: idSchema("ajuste_detalle_id").required().messages({
    "any.required": "ajuste_detalle_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryAdjustmentDetailCreateValidation = Joi.object({
  cantidad_antes: nonNegativeNumberSchema("La cantidad antes").required().messages({
    "any.required": "La cantidad antes es obligatoria.",
  }),
  cantidad_contada: nonNegativeNumberSchema("La cantidad contada").required().messages({
    "any.required": "La cantidad contada es obligatoria.",
  }),
  diferencia: Joi.number().required().messages({
    "number.base": "La diferencia debe ser un numero.",
    "any.required": "La diferencia es obligatoria.",
  }),
  tipo_ajuste: tipoAjusteSchema.required().messages({
    "any.required": "El tipo de ajuste es obligatorio.",
  }),
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
  existencia_id: idSchema("existencia_id").optional().allow(null),
  inventory_adjustment_id: idSchema("inventory_adjustment_id").required().messages({
    "any.required": "inventory_adjustment_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryAdjustmentDetailUpdateBodyValidation = Joi.object({
  cantidad_antes: nonNegativeNumberSchema("La cantidad antes"),
  cantidad_contada: nonNegativeNumberSchema("La cantidad contada"),
  diferencia: Joi.number().messages({
    "number.base": "La diferencia debe ser un numero.",
  }),
  tipo_ajuste: tipoAjusteSchema,
  item_id: idSchema("item_id"),
  existencia_id: idSchema("existencia_id").optional().allow(null),
  inventory_adjustment_id: idSchema("inventory_adjustment_id"),
})
  .or(
    "cantidad_antes",
    "cantidad_contada",
    "diferencia",
    "tipo_ajuste",
    "item_id",
    "existencia_id",
    "inventory_adjustment_id",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

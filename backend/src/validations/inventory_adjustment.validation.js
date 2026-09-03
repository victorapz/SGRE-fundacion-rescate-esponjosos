"use strict";

import Joi from "joi";
import {
  idSchema,
  isoDateSchema,
  nonNegativeNumberSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const estadoSchema = Joi.string()
  .valid("PENDIENTE", "APLICADO", "CANCELADO")
  .messages({
    "any.only": "El estado no es valido.",
    "string.base": "El estado debe ser de tipo string.",
  });

export const inventoryAdjustmentQueryValidation = Joi.object({
  ajuste_inventario_id: idSchema("ajuste_inventario_id").required().messages({
    "any.required": "ajuste_inventario_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryAdjustmentCreateValidation = Joi.object({
  fecha_ajuste: isoDateSchema("La fecha de ajuste").required().messages({
    "any.required": "La fecha de ajuste es obligatoria.",
  }),
  motivo: requiredTextSchema("El motivo").required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  estado: estadoSchema.optional(),
  observaciones: optionalTextSchema("Las observaciones"),
  location_id: idSchema("location_id").required().messages({
    "any.required": "location_id es obligatorio.",
  }),
  performed_by_id: idSchema("performed_by_id").optional(),
  stock_count_id: idSchema("stock_count_id").optional().allow(null),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryAdjustmentUpdateBodyValidation = Joi.object({
  fecha_ajuste: isoDateSchema("La fecha de ajuste"),
  motivo: requiredTextSchema("El motivo"),
  estado: estadoSchema,
  observaciones: optionalTextSchema("Las observaciones"),
  location_id: idSchema("location_id"),
  performed_by_id: idSchema("performed_by_id"),
  stock_count_id: idSchema("stock_count_id").optional().allow(null),
})
  .or(
    "fecha_ajuste",
    "motivo",
    "estado",
    "observaciones",
    "location_id",
    "performed_by_id",
    "stock_count_id",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

const adjustmentDetailInputSchema = Joi.object({
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
  existencia_id: idSchema("existencia_id").optional().allow(null),
  cantidad_antes: nonNegativeNumberSchema("La cantidad antes").required().messages({
    "any.required": "La cantidad antes es obligatoria.",
  }),
  cantidad_contada: nonNegativeNumberSchema("La cantidad contada").required().messages({
    "any.required": "La cantidad contada es obligatoria.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en cada detalle.",
  });

export const inventoryAdjustmentManualValidation = Joi.object({
  fecha_ajuste: isoDateSchema("La fecha de ajuste").optional(),
  motivo: requiredTextSchema("El motivo").required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  location_id: idSchema("location_id").required().messages({
    "any.required": "location_id es obligatorio.",
  }),
  performed_by_id: idSchema("performed_by_id").optional(),
  detalles: Joi.array().items(adjustmentDetailInputSchema).min(1).required().messages({
    "array.base": "detalles debe ser una lista.",
    "array.min": "Debes proporcionar al menos un detalle de ajuste.",
    "any.required": "detalles es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryAdjustmentFromStockCountValidation = Joi.object({
  stock_count_id: idSchema("stock_count_id").required().messages({
    "any.required": "stock_count_id es obligatorio.",
  }),
  fecha_ajuste: isoDateSchema("La fecha de ajuste").optional(),
  motivo: requiredTextSchema("El motivo").required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  performed_by_id: idSchema("performed_by_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

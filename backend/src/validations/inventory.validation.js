"use strict";

import Joi from "joi";
import {
  idSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
  positiveNumberSchema,
} from "./inventory.shared.validation.js";

const condicionSchema = Joi.string()
  .valid("NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO")
  .optional();

const validateDateRange = (value, helpers) => {
  if (
    value.fecha_apertura
    && value.fecha_vencimiento
    && new Date(value.fecha_apertura) > new Date(value.fecha_vencimiento)
  ) {
    return helpers.message(
      "La fecha de apertura no puede ser posterior a la fecha de vencimiento.",
    );
  }
  return value;
};

export const inventorySummaryQueryValidation = Joi.object({
  location_id: idSchema("location_id").optional(),
  categoria_item_id: idSchema("categoria_item_id").optional(),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const inventoryItemDetailQueryValidation = Joi.object({
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
  location_id: idSchema("location_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const consumeInventoryValidation = Joi.object({
  existencia_id: idSchema("existencia_id").required().messages({
    "any.required": "existencia_id es obligatorio.",
  }),
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  performed_by_id: idSchema("performed_by_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const exitInventoryValidation = Joi.object({
  existencia_id: idSchema("existencia_id").required().messages({
    "any.required": "existencia_id es obligatorio.",
  }),
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  motivo: optionalTextSchema("El motivo", 255),
  observaciones: optionalTextSchema("Las observaciones"),
  performed_by_id: idSchema("performed_by_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const transferInventoryValidation = Joi.object({
  existencia_id: idSchema("existencia_id").required().messages({
    "any.required": "existencia_id es obligatorio.",
  }),
  destination_location_id: idSchema("destination_location_id").required().messages({
    "any.required": "destination_location_id es obligatorio.",
  }),
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  performed_by_id: idSchema("performed_by_id").optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const initialInventoryLoadValidation = Joi.object({
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
  ubicacion_id: idSchema("ubicacion_id").required().messages({
    "any.required": "ubicacion_id es obligatorio.",
  }),
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condicion: condicionSchema,
  observaciones: optionalTextSchema("Las observaciones"),
  performed_by_id: idSchema("performed_by_id").optional(),
})
  .custom(validateDateRange)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

"use strict";

import Joi from "joi";
import {
  idSchema,
  nonNegativeNumberSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
  positiveNumberSchema,
} from "./inventory.shared.validation.js";

const estadoSchema = Joi.string()
  .valid("PENDIENTE", "PARCIAL", "COMPLETO", "CERRADO_INCOMPLETO", "CANCELADO")
  .messages({
    "any.only": "El estado no es valido.",
    "string.base": "El estado debe ser de tipo string.",
  });

const condicionSchema = Joi.string()
  .valid("NUEVO", "USADO_BUENO", "USADO_MALO", "DEFECTUOSO")
  .messages({
    "any.only": "La condicion no es valida.",
    "string.base": "La condicion debe ser de tipo string.",
  });

const withDetailConsistency = (value, helpers) => {
  if (
    value.fecha_apertura
    && value.fecha_vencimiento
    && new Date(value.fecha_apertura) > new Date(value.fecha_vencimiento)
  ) {
    return helpers.message(
      "La fecha de apertura no puede ser posterior a la fecha de vencimiento.",
    );
  }

  if (
    value.cantidad !== undefined
    && value.cantidad_recepcionada !== undefined
    && Number(value.cantidad_recepcionada) > Number(value.cantidad)
  ) {
    return helpers.message(
      "La cantidad recepcionada no puede exceder la cantidad declarada.",
    );
  }

  return value;
};

export const purchaseDetailQueryValidation = Joi.object({
  detalle_compra_id: idSchema("detalle_compra_id").required().messages({
    "any.required": "detalle_compra_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const purchaseDetailCreateValidation = Joi.object({
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  precio_unitario: positiveNumberSchema("El precio unitario").required().messages({
    "any.required": "El precio unitario es obligatorio.",
  }),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condiciones_almacenamiento: optionalTextSchema("Las condiciones de almacenamiento"),
  condicion: condicionSchema.optional(),
  observaciones: optionalTextSchema("Las observaciones"),
  purchase_id: idSchema("purchase_id").required().messages({
    "any.required": "purchase_id es obligatorio.",
  }),
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
})
  .custom(withDetailConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const purchaseDetailUpdateBodyValidation = Joi.object({
  cantidad: positiveNumberSchema("La cantidad"),
  precio_unitario: positiveNumberSchema("El precio unitario"),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condiciones_almacenamiento: optionalTextSchema("Las condiciones de almacenamiento"),
  condicion: condicionSchema.optional(),
  observaciones: optionalTextSchema("Las observaciones"),
  purchase_id: idSchema("purchase_id"),
  item_id: idSchema("item_id"),
})
  .or(
    "cantidad",
    "precio_unitario",
    "fecha_vencimiento",
    "fecha_apertura",
    "condiciones_almacenamiento",
    "condicion",
    "observaciones",
    "purchase_id",
    "item_id",
  )
  .custom(withDetailConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

export const receivePurchaseDetailValidation = Joi.object({
  purchase_detail_id: idSchema("purchase_detail_id").required().messages({
    "any.required": "purchase_detail_id es obligatorio.",
  }),
  cantidad_a_recepcionar: positiveNumberSchema("La cantidad a recepcionar").required().messages({
    "any.required": "La cantidad a recepcionar es obligatoria.",
  }),
  destination_location_id: idSchema("destination_location_id").required().messages({
    "any.required": "destination_location_id es obligatorio.",
  }),
  fecha_recepcion: Joi.date().iso().required().messages({
    "any.required": "La fecha de recepcion es obligatoria.",
    "date.base": "La fecha de recepcion debe ser valida.",
    "date.format": "La fecha de recepcion debe tener formato ISO.",
  }),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condicion: condicionSchema.optional(),
  condiciones_almacenamiento: optionalTextSchema("Las condiciones de almacenamiento"),
  observaciones: optionalTextSchema("Las observaciones"),
  cierra_detalle: Joi.boolean().optional(),
  idempotency_key: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required().messages({
    "any.required": "La idempotency_key es obligatoria.",
    "string.guid": "La idempotency_key debe ser un UUID valido.",
  }),
})
  .custom(withDetailConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const receivePurchaseDetailsBulkValidation = Joi.object({
  purchase_id: idSchema("purchase_id").required().messages({
    "any.required": "purchase_id es obligatorio.",
  }),
  purchase_detail_ids: Joi.array()
    .items(idSchema("purchase_detail_id"))
    .min(1)
    .max(100)
    .unique()
    .required()
    .messages({
      "any.required": "purchase_detail_ids es obligatorio.",
      "array.base": "purchase_detail_ids debe ser un arreglo.",
      "array.min": "Debes seleccionar al menos un detalle de compra.",
      "array.max": "No puedes recepcionar mas de 100 detalles por lote.",
      "array.unique": "purchase_detail_ids no puede contener valores repetidos.",
    }),
  destination_location_id: idSchema("destination_location_id").required().messages({
    "any.required": "destination_location_id es obligatorio.",
  }),
  fecha_recepcion: Joi.date().iso().required().messages({
    "any.required": "La fecha de recepcion es obligatoria.",
    "date.base": "La fecha de recepcion debe ser valida.",
    "date.format": "La fecha de recepcion debe tener formato ISO.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  idempotency_key: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required().messages({
    "any.required": "La idempotency_key es obligatoria.",
    "string.guid": "La idempotency_key debe ser un UUID valido.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

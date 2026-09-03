"use strict";

import Joi from "joi";
import {
  idSchema,
  nonNegativeNumberSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
  positiveNumberSchema,
  requiredTextSchema,
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

const withDateConsistency = (value, helpers) => {
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

export const donationItemQueryValidation = Joi.object({
  donacion_individual_id: idSchema("donacion_individual_id").required().messages({
    "any.required": "donacion_individual_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donationItemCreateValidation = Joi.object({
  cantidad: positiveNumberSchema("La cantidad").required().messages({
    "any.required": "La cantidad es obligatoria.",
  }),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condiciones_almacenamiento: requiredTextSchema(
    "Las condiciones de almacenamiento",
  ).required().messages({
    "any.required": "Las condiciones de almacenamiento son obligatorias.",
  }),
  condicion: condicionSchema.required().messages({
    "any.required": "La condicion es obligatoria.",
  }),
  observaciones: optionalTextSchema("Las observaciones"),
  donation_id: idSchema("donation_id").required().messages({
    "any.required": "donation_id es obligatorio.",
  }),
  item_id: idSchema("item_id").required().messages({
    "any.required": "item_id es obligatorio.",
  }),
})
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donationItemUpdateBodyValidation = Joi.object({
  cantidad: positiveNumberSchema("La cantidad"),
  fecha_vencimiento: optionalIsoDateSchema("La fecha de vencimiento"),
  fecha_apertura: optionalIsoDateSchema("La fecha de apertura"),
  condiciones_almacenamiento: requiredTextSchema(
    "Las condiciones de almacenamiento",
  ),
  condicion: condicionSchema,
  observaciones: optionalTextSchema("Las observaciones"),
  donation_id: idSchema("donation_id"),
  item_id: idSchema("item_id"),
})
  .or(
    "cantidad",
    "fecha_vencimiento",
    "fecha_apertura",
    "condiciones_almacenamiento",
    "condicion",
    "observaciones",
    "donation_id",
    "item_id",
  )
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

export const receiveDonationItemValidation = Joi.object({
  donation_item_id: idSchema("donation_item_id").required().messages({
    "any.required": "donation_item_id es obligatorio.",
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
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const receiveDonationItemsBulkValidation = Joi.object({
  donation_id: idSchema("donation_id").required().messages({
    "any.required": "donation_id es obligatorio.",
  }),
  donation_item_ids: Joi.array()
    .items(idSchema("donation_item_id"))
    .min(1)
    .max(100)
    .unique()
    .required()
    .messages({
      "any.required": "donation_item_ids es obligatorio.",
      "array.base": "donation_item_ids debe ser un arreglo.",
      "array.min": "Debes seleccionar al menos un item de donacion.",
      "array.max": "No puedes recepcionar mas de 100 items por lote.",
      "array.unique": "donation_item_ids no puede contener valores repetidos.",
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

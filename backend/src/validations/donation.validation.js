"use strict";

import Joi from "joi";
import {
  idSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const estadoSchema = Joi.string()
  .valid("PENDIENTE", "RECEPCIONADO", "CANCELADO")
  .messages({
    "any.only": "El estado no es valido.",
    "string.base": "El estado debe ser de tipo string.",
  });

const withDateConsistency = (value, helpers) => {
  if (
    value.fecha_recepcion
    && value.fecha_registro
    && new Date(value.fecha_recepcion) < new Date(value.fecha_registro)
  ) {
    return helpers.message(
      "La fecha de recepcion no puede ser anterior a la fecha de registro.",
    );
  }
  return value;
};

export const donationQueryValidation = Joi.object({
  donacion_id: idSchema("donacion_id").required().messages({
    "any.required": "donacion_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donationCreateValidation = Joi.object({
  motivo_donacion: requiredTextSchema("El motivo de donacion").required().messages({
    "any.required": "El motivo de donacion es obligatorio.",
  }),
  punto_encuentro: optionalTextSchema("El punto de encuentro", 255),
  fecha_registro: isoDateSchema("La fecha de registro").required().messages({
    "any.required": "La fecha de registro es obligatoria.",
  }),
  fecha_recepcion: optionalIsoDateSchema("La fecha de recepcion"),
  estado: estadoSchema.optional(),
  observaciones: optionalTextSchema("Las observaciones"),
  donor_id: idSchema("donor_id").optional().allow(null),
  region_id: idSchema("region_id").required().messages({
    "any.required": "region_id es obligatorio.",
  }),
  receiving_user_id: idSchema("receiving_user_id").required().messages({
    "any.required": "receiving_user_id es obligatorio.",
  }),
})
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const donationUpdateBodyValidation = Joi.object({
  motivo_donacion: requiredTextSchema("El motivo de donacion"),
  punto_encuentro: optionalTextSchema("El punto de encuentro", 255),
  fecha_registro: isoDateSchema("La fecha de registro"),
  fecha_recepcion: optionalIsoDateSchema("La fecha de recepcion"),
  estado: estadoSchema,
  observaciones: optionalTextSchema("Las observaciones"),
  donor_id: idSchema("donor_id").optional().allow(null),
  region_id: idSchema("region_id"),
  receiving_user_id: idSchema("receiving_user_id"),
})
  .or(
    "motivo_donacion",
    "punto_encuentro",
    "fecha_registro",
    "fecha_recepcion",
    "estado",
    "observaciones",
    "donor_id",
    "region_id",
    "receiving_user_id",
  )
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

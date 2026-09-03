"use strict";

import Joi from "joi";
import {
  localDateSchema,
  localizedDecimalSchema,
  nullableIdSchema,
  positiveIdSchema,
} from "./clinical.shared.validation.js";
import {
  currencySchema,
  financialNoteSchema,
  nullableMoneyAmountSchema,
  payableFlagSchema,
  paymentDueDateSchema,
} from "./financial.shared.validation.js";

const string255Schema = Joi.string()
  .trim()
  .min(1)
  .max(255)
  .messages({
    "string.empty": "Este campo no puede estar vacio.",
    "string.base": "Este campo debe ser de tipo string.",
    "string.min": "Este campo debe tener como minimo 1 caracter.",
    "string.max": "Este campo debe tener como maximo 255 caracteres.",
  });

const optionalTextSchema = Joi.string()
  .trim()
  .allow(null, "")
  .messages({
    "string.base": "Este campo debe ser de tipo string.",
  });

const legacyPriceSchema = Joi.string()
  .trim()
  .max(255)
  .allow(null, "")
  .messages({
    "string.base": "El precio legado debe ser de tipo string.",
    "string.max": "El precio legado debe tener como maximo 255 caracteres.",
  });

const idSchema = positiveIdSchema("El id");

const withPayableConsistency = (value, helpers) => {
  if (value.genera_cuenta_por_pagar === true && !(value.monto_total > 0)) {
    return helpers.message(
      "Si genera_cuenta_por_pagar es true, monto_total debe ser mayor a 0.",
    );
  }

  return value;
};

export const examQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const examCreateValidation = Joi.object({
  fecha_solicitud: localDateSchema("La fecha del examen", { required: true })
    .required()
    .messages({
      "any.required": "La fecha del examen es obligatoria.",
    }),
  nombre_examen: string255Schema.required().messages({
    "any.required": "El nombre del examen es obligatorio.",
  }),
  motivo: string255Schema.required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  peso: localizedDecimalSchema("El peso").optional(),
  temperatura: localizedDecimalSchema("La temperatura").optional(),
  fecha_entrega_resultado: localDateSchema("La fecha de entrega del resultado").optional(),
  diagnostico: optionalTextSchema.optional(),
  indicaciones: optionalTextSchema.optional(),
  precio: legacyPriceSchema.optional(),
  monto_total: nullableMoneyAmountSchema("El monto total").optional(),
  moneda: currencySchema("La moneda").default("CLP"),
  genera_cuenta_por_pagar: payableFlagSchema.default(false),
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  veterinarian_id: nullableIdSchema.optional(),
  clinic_id: positiveIdSchema("La clinica"),
  animal_id: positiveIdSchema("El animal"),
})
  .custom(withPayableConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const examUpdateBodyValidation = Joi.object({
  fecha_solicitud: localDateSchema("La fecha del examen"),
  nombre_examen: string255Schema,
  motivo: string255Schema,
  peso: localizedDecimalSchema("El peso"),
  temperatura: localizedDecimalSchema("La temperatura"),
  fecha_entrega_resultado: localDateSchema("La fecha de entrega del resultado"),
  diagnostico: optionalTextSchema,
  indicaciones: optionalTextSchema,
  precio: legacyPriceSchema,
  monto_total: nullableMoneyAmountSchema("El monto total"),
  moneda: currencySchema("La moneda"),
  genera_cuenta_por_pagar: payableFlagSchema,
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  veterinarian_id: nullableIdSchema,
  clinic_id: positiveIdSchema("La clinica").optional(),
  animal_id: positiveIdSchema("El animal").optional(),
})
  .or(
    "fecha_solicitud",
    "nombre_examen",
    "motivo",
    "peso",
    "temperatura",
    "fecha_entrega_resultado",
    "diagnostico",
    "indicaciones",
    "precio",
    "monto_total",
    "moneda",
    "genera_cuenta_por_pagar",
    "fecha_vencimiento_pago",
    "observacion_financiera",
    "veterinarian_id",
    "clinic_id",
    "animal_id",
  )
  .custom(withPayableConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

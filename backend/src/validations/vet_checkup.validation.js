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
  .max(40)
  .allow(null, "")
  .messages({
    "string.base": "El precio legado debe ser de tipo string.",
    "string.max": "El precio legado debe tener como maximo 40 caracteres.",
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

const withChronologyConsistency = (value, helpers) => {
  if (
    value.fecha
    && value.fecha_proximo_control
    && value.fecha_proximo_control <= value.fecha
  ) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  return value;
};

export const vetCheckupQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const vetCheckupCreateValidation = Joi.object({
  fecha: localDateSchema("La fecha", { required: true })
    .required()
    .messages({
      "any.required": "La fecha es obligatoria.",
    }),
  motivo: string255Schema.required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  peso: localizedDecimalSchema("El peso").optional(),
  temperatura: localizedDecimalSchema("La temperatura").optional(),
  diagnostico: optionalTextSchema.optional(),
  observaciones: optionalTextSchema.optional(),
  indicaciones_casa: optionalTextSchema.optional(),
  indicaciones_examenes: optionalTextSchema.optional(),
  indicaciones_procedimiento: optionalTextSchema.optional(),
  precio: legacyPriceSchema.optional(),
  monto_total: nullableMoneyAmountSchema("El monto total").optional(),
  moneda: currencySchema("La moneda").default("CLP"),
  genera_cuenta_por_pagar: payableFlagSchema.default(false),
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  fecha_proximo_control: localDateSchema("La fecha del proximo control", { required: true })
    .required()
    .messages({
      "any.required": "La fecha del proximo control es obligatoria.",
    }),
  animal_id: positiveIdSchema("El animal"),
  veterinarian_id: nullableIdSchema.optional(),
  clinic_id: positiveIdSchema("La clinica"),
})
  .custom(withPayableConsistency)
  .custom(withChronologyConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const vetCheckupUpdateBodyValidation = Joi.object({
  fecha: localDateSchema("La fecha"),
  motivo: string255Schema,
  peso: localizedDecimalSchema("El peso"),
  temperatura: localizedDecimalSchema("La temperatura"),
  diagnostico: optionalTextSchema,
  observaciones: optionalTextSchema,
  indicaciones_casa: optionalTextSchema,
  indicaciones_examenes: optionalTextSchema,
  indicaciones_procedimiento: optionalTextSchema,
  precio: legacyPriceSchema,
  monto_total: nullableMoneyAmountSchema("El monto total"),
  moneda: currencySchema("La moneda"),
  genera_cuenta_por_pagar: payableFlagSchema,
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  fecha_proximo_control: localDateSchema("La fecha del proximo control"),
  animal_id: positiveIdSchema("El animal").optional(),
  veterinarian_id: nullableIdSchema,
  clinic_id: positiveIdSchema("La clinica").optional(),
})
  .or(
    "fecha",
    "motivo",
    "peso",
    "temperatura",
    "diagnostico",
    "observaciones",
    "indicaciones_casa",
    "indicaciones_examenes",
    "indicaciones_procedimiento",
    "precio",
    "monto_total",
    "moneda",
    "genera_cuenta_por_pagar",
    "fecha_vencimiento_pago",
    "observacion_financiera",
    "fecha_proximo_control",
    "animal_id",
    "veterinarian_id",
    "clinic_id",
  )
  .custom(withPayableConsistency)
  .custom(withChronologyConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

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
  .max(20)
  .allow(null, "")
  .messages({
    "string.base": "El precio legado debe ser de tipo string.",
    "string.max": "El precio legado debe tener como maximo 20 caracteres.",
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
  if (value.fecha_alta && value.fecha_ingreso && value.fecha_alta < value.fecha_ingreso) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  if (
    value.fecha_control_post_alta
    && value.fecha_ingreso
    && value.fecha_control_post_alta < value.fecha_ingreso
  ) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  if (
    value.fecha_control_post_alta
    && value.fecha_alta
    && value.fecha_control_post_alta < value.fecha_alta
  ) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  return value;
};

export const hospitalizationQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const hospitalizationCreateValidation = Joi.object({
  fecha_ingreso: localDateSchema("La fecha de ingreso", { required: true })
    .required()
    .messages({
      "any.required": "La fecha de ingreso es obligatoria.",
    }),
  fecha_alta: localDateSchema("La fecha de alta").optional(),
  motivo: string255Schema.required().messages({
    "any.required": "El motivo es obligatorio.",
  }),
  diagnostico: optionalTextSchema.optional(),
  pronostico: optionalTextSchema.optional(),
  peso_ingreso: localizedDecimalSchema("El peso de ingreso").optional(),
  temperatura_ingreso: localizedDecimalSchema("La temperatura de ingreso").optional(),
  farmacos_recetados: optionalTextSchema.optional(),
  examenes_realizados: optionalTextSchema.optional(),
  indicaciones_hospital: optionalTextSchema.optional(),
  indicaciones_casa: optionalTextSchema.optional(),
  precio: legacyPriceSchema.optional(),
  monto_total: nullableMoneyAmountSchema("El monto total").optional(),
  moneda: currencySchema("La moneda").default("CLP"),
  genera_cuenta_por_pagar: payableFlagSchema.default(false),
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  fecha_control_post_alta: localDateSchema("La fecha de control postalta", { required: true })
    .required()
    .messages({
      "any.required": "La fecha de control postalta es obligatoria.",
    }),
  veterinarian_id: nullableIdSchema.optional(),
  clinic_id: positiveIdSchema("La clinica"),
  animal_id: positiveIdSchema("El animal"),
})
  .custom(withPayableConsistency)
  .custom(withChronologyConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const hospitalizationUpdateBodyValidation = Joi.object({
  fecha_ingreso: localDateSchema("La fecha de ingreso"),
  fecha_alta: localDateSchema("La fecha de alta"),
  motivo: string255Schema,
  diagnostico: optionalTextSchema,
  pronostico: optionalTextSchema,
  peso_ingreso: localizedDecimalSchema("El peso de ingreso"),
  temperatura_ingreso: localizedDecimalSchema("La temperatura de ingreso"),
  farmacos_recetados: optionalTextSchema,
  examenes_realizados: optionalTextSchema,
  indicaciones_hospital: optionalTextSchema,
  indicaciones_casa: optionalTextSchema,
  precio: legacyPriceSchema,
  monto_total: nullableMoneyAmountSchema("El monto total"),
  moneda: currencySchema("La moneda"),
  genera_cuenta_por_pagar: payableFlagSchema,
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  fecha_control_post_alta: localDateSchema("La fecha de control postalta"),
  veterinarian_id: nullableIdSchema,
  clinic_id: positiveIdSchema("La clinica").optional(),
  animal_id: positiveIdSchema("El animal").optional(),
})
  .or(
    "fecha_ingreso",
    "fecha_alta",
    "motivo",
    "diagnostico",
    "pronostico",
    "peso_ingreso",
    "temperatura_ingreso",
    "farmacos_recetados",
    "examenes_realizados",
    "indicaciones_hospital",
    "indicaciones_casa",
    "precio",
    "monto_total",
    "moneda",
    "genera_cuenta_por_pagar",
    "fecha_vencimiento_pago",
    "observacion_financiera",
    "fecha_control_post_alta",
    "veterinarian_id",
    "clinic_id",
    "animal_id",
  )
  .custom(withPayableConsistency)
  .custom(withChronologyConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

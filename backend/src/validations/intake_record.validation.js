"use strict";

import Joi from "joi";

function isFutureDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return parsed.getTime() > todayUtc;
}

const requiredDateSchema = Joi.string()
  .isoDate()
  .custom((value, helpers) => {
    if (isFutureDate(value)) {
      return helpers.message("La fecha no puede ser futura.");
    }

    return value;
  })
  .messages({
    "string.base": "La fecha debe ser de tipo string.",
    "string.empty": "La fecha no puede estar vacia.",
    "string.isoDate": "La fecha debe tener formato YYYY-MM-DD.",
  });

const optionalString255Schema = Joi.string()
  .trim()
  .max(255)
  .allow("", null)
  .messages({
    "string.base": "Este campo debe ser de tipo string.",
    "string.max": "Este campo debe tener como maximo 255 caracteres.",
  });

const optionalTextSchema = Joi.string()
  .allow("", null)
  .messages({
    "string.base": "Este campo debe ser de tipo string.",
  });

const optionalIdSchema = Joi.alternatives().try(
  Joi.number().integer().positive().messages({
    "number.base": "El id debe ser un numero.",
    "number.integer": "El id debe ser un numero entero.",
    "number.positive": "El id debe ser un numero positivo.",
  }),
  Joi.valid(null),
);

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

export const intakeRecordQueryValidation = Joi.object({
  id: idSchema,
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const intakeRecordCreateValidation = Joi.object({
  fecha_entrega: requiredDateSchema.required().messages({
    "any.required": "La fecha de llegada a la fundacion es obligatoria.",
  }),
  estado_reproduccion_inicial: optionalString255Schema.optional(),
  edad_estimada: optionalString255Schema.optional(),
  lugar_entrega: optionalString255Schema.optional(),
  causa_entrega: optionalString255Schema.optional(),
  condiciones_iniciales: optionalTextSchema.optional(),
  nombre_quien_entrega: optionalString255Schema.optional(),
  animal_id: idSchema.required().messages({
    "any.required": "animal_id es obligatorio.",
  }),
  quien_recibe_id: optionalIdSchema.optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const intakeRecordUpdateBodyValidation = Joi.object({
  fecha_entrega: requiredDateSchema,
  estado_reproduccion_inicial: optionalString255Schema,
  edad_estimada: optionalString255Schema,
  lugar_entrega: optionalString255Schema,
  causa_entrega: optionalString255Schema,
  condiciones_iniciales: optionalTextSchema,
  nombre_quien_entrega: optionalString255Schema,
  animal_id: idSchema,
  quien_recibe_id: optionalIdSchema,
})
  .or(
    "fecha_entrega",
    "estado_reproduccion_inicial",
    "edad_estimada",
    "lugar_entrega",
    "causa_entrega",
    "condiciones_iniciales",
    "nombre_quien_entrega",
    "animal_id",
    "quien_recibe_id",
  )
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

"use strict";

import Joi from "joi";
import {
  EstadoAdopcion,
  EstadoSalud,
  TipoFechaNacimiento,
} from "../entities/animalConcept/animal.entity.js";

const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(255)
  .messages({
    "string.empty": "Este campo no puede estar vacio.",
    "string.base": "Este campo debe ser de tipo string.",
    "string.min": "Este campo debe tener como minimo 2 caracteres.",
    "string.max": "Este campo debe tener como maximo 255 caracteres.",
  });

const sexoSchema = Joi.string()
  .trim()
  .min(1)
  .max(10)
  .messages({
    "string.empty": "El sexo no puede estar vacio.",
    "string.base": "El sexo debe ser de tipo string.",
    "string.min": "El sexo debe tener como minimo 1 caracter.",
    "string.max": "El sexo debe tener como maximo 10 caracteres.",
  });

const especieSchema = Joi.string()
  .trim()
  .min(2)
  .max(255)
  .messages({
    "string.empty": "La especie no puede estar vacia.",
    "string.base": "La especie debe ser de tipo string.",
    "string.min": "La especie debe tener como minimo 2 caracteres.",
    "string.max": "La especie debe tener como maximo 255 caracteres.",
  });

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

const optionalDateSchema = Joi.alternatives()
  .try(requiredDateSchema, Joi.valid(null))
  .messages({
    "alternatives.match": "La fecha debe tener formato YYYY-MM-DD o ser null.",
  });

const estadoSaludSchema = Joi.string()
  .valid(...Object.values(EstadoSalud))
  .messages({
    "any.only": "El estado de salud actual no es valido.",
    "string.base": "El estado de salud actual debe ser de tipo string.",
  });

const estadoAdopcionSchema = Joi.string()
  .valid(...Object.values(EstadoAdopcion))
  .allow(null)
  .messages({
    "any.only": "El estado de adopción no es valido.",
    "string.base": "El estado de adopción debe ser de tipo string.",
  });

const tipoFechaNacimientoSchema = Joi.string()
  .valid(...Object.values(TipoFechaNacimiento))
  .messages({
    "any.only": "El tipo de fecha de nacimiento no es valido.",
    "string.base": "El tipo de fecha de nacimiento debe ser de tipo string.",
  });

const regionIdSchema = Joi.number().integer().positive().messages({
  "number.base": "region_id debe ser un numero.",
  "number.integer": "region_id debe ser un numero entero.",
  "number.positive": "region_id debe ser un numero positivo.",
});

function validateAnimalDates(value, helpers) {
  const tipoFechaNacimiento =
    value.tipo_fecha_nacimiento ?? TipoFechaNacimiento.DESCONOCIDA;

  if (
    [TipoFechaNacimiento.REAL, TipoFechaNacimiento.ESTIMADA].includes(
      tipoFechaNacimiento,
    ) &&
    !value.fecha_nacimiento
  ) {
    return helpers.message(
      "La fecha de nacimiento es obligatoria cuando el tipo es REAL o ESTIMADA.",
    );
  }

  if (
    tipoFechaNacimiento === TipoFechaNacimiento.DESCONOCIDA &&
    value.fecha_nacimiento &&
    !value.tipo_fecha_nacimiento
  ) {
    return helpers.message(
      "Debes indicar si la fecha de nacimiento es REAL, ESTIMADA o DESCONOCIDA.",
    );
  }

  if (!value.fallecido && value.fecha_fallecimiento) {
    return helpers.message(
      "La fecha de fallecimiento solo se permite si fallecido es true.",
    );
  }

  return value;
}

export const animalQueryValidation = Joi.object({
  id: Joi.number().integer().positive().messages({
    "number.base": "El id debe ser un numero.",
    "number.integer": "El id debe ser un numero entero.",
    "number.positive": "El id debe ser un numero positivo.",
  }),
})
  .or("id")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar el parametro id.",
  });

export const animalCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  sexo: sexoSchema.required().messages({
    "any.required": "El sexo es obligatorio.",
  }),
  especie: especieSchema.required().messages({
    "any.required": "La especie es obligatoria.",
  }),
  fecha_nacimiento: optionalDateSchema.optional(),
  tipo_fecha_nacimiento: tipoFechaNacimientoSchema.optional(),
  estado_salud_actual: estadoSaludSchema.required().messages({
    "any.required": "El estado de salud actual es obligatorio.",
  }),
  estado_adopcion: estadoAdopcionSchema.optional(),
  fecha_llegada_fundacion: optionalDateSchema.optional(),
  fallecido: Joi.boolean().optional(),
  fecha_fallecimiento: optionalDateSchema.optional(),
  region_id: regionIdSchema.required().messages({
    "any.required": "region_id es obligatorio.",
  }),
})
  .custom(validateAnimalDates)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const animalUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  sexo: sexoSchema,
  especie: especieSchema,
  fecha_nacimiento: optionalDateSchema,
  tipo_fecha_nacimiento: tipoFechaNacimientoSchema,
  estado_salud_actual: estadoSaludSchema,
  estado_adopcion: estadoAdopcionSchema,
  fecha_llegada_fundacion: optionalDateSchema,
  fallecido: Joi.boolean(),
  fecha_fallecimiento: optionalDateSchema,
  region_id: regionIdSchema,
})
  .or(
    "nombre",
    "sexo",
    "especie",
    "fecha_nacimiento",
    "tipo_fecha_nacimiento",
    "estado_salud_actual",
    "estado_adopcion",
    "fecha_llegada_fundacion",
    "fallecido",
    "fecha_fallecimiento",
    "region_id",
  )
  .custom(validateAnimalDates)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

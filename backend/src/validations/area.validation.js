"use strict";

import Joi from "joi";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un número.",
  "number.integer": "El id debe ser un número entero.",
  "number.positive": "El id debe ser un número positivo.",
});

const nombreSchema = Joi.string().trim().min(1).max(255).messages({
  "string.empty": "El nombre del área es obligatorio.",
  "string.base": "El nombre del área debe ser de tipo texto.",
  "string.min": "El nombre del área debe tener al menos 1 caracter.",
  "string.max": "El nombre del área no puede superar 255 caracteres.",
});

const claveSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[A-Za-z0-9_-]+$/)
  .messages({
    "string.empty": "La clave del área es obligatoria.",
    "string.base": "La clave del área debe ser de tipo texto.",
    "string.min": "La clave del área debe tener al menos 2 caracteres.",
    "string.max": "La clave del área no puede superar 50 caracteres.",
    "string.pattern.base":
      "La clave del área sólo puede contener letras, números, guiones y guiones bajos.",
  });

const descripcionSchema = Joi.string().trim().allow("").max(255).messages({
  "string.base": "La descripción debe ser de tipo texto.",
  "string.max": "La descripción no puede superar 255 caracteres.",
});

export const areaQueryValidation = Joi.object({
  id_area: idSchema.required().messages({
    "any.required": "id_area es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const areaCreateValidation = Joi.object({
  nombre: nombreSchema.required(),
  clave: claveSchema.required(),
  descripcion: descripcionSchema.default(""),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const areaUpdateValidation = Joi.object({
  nombre: nombreSchema,
  clave: claveSchema,
  descripcion: descripcionSchema,
  activo: Joi.boolean(),
})
  .or("nombre", "clave", "descripcion", "activo")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

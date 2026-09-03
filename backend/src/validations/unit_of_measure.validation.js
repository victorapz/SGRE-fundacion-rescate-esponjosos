"use strict";

import Joi from "joi";
import {
  idSchema,
  optionalTextSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const nameSchema = requiredTextSchema("El nombre", 100);

export const unitOfMeasureQueryValidation = Joi.object({
  unidad_medida_id: idSchema("unidad_medida_id").required().messages({
    "any.required": "unidad_medida_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const unitOfMeasureCreateValidation = Joi.object({
  nombre: nameSchema.required().messages({
    "any.required": "El nombre es obligatorio.",
  }),
  descripcion: optionalTextSchema("La descripcion"),
  activo: Joi.boolean().optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const unitOfMeasureUpdateBodyValidation = Joi.object({
  nombre: nameSchema,
  descripcion: optionalTextSchema("La descripcion"),
  activo: Joi.boolean(),
})
  .or("nombre", "descripcion", "activo")
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

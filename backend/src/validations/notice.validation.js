"use strict";

import Joi from "joi";

const noticeSummarySchema = Joi.string()
  .allow(null, "")
  .trim()
  .max(500)
  .messages({
    "string.max": "El resumen no puede exceder 500 caracteres",
  });

export const noticeCreateValidation = Joi.object({
  titulo: Joi.string()
    .required()
    .max(255)
    .trim()
    .messages({
      "string.empty": "El titulo es requerido",
      "string.max": "El titulo no puede exceder 255 caracteres",
      "any.required": "El titulo es obligatorio",
    }),
  descripcion: Joi.string()
    .required()
    .trim()
    .messages({
      "string.empty": "La descripcion es requerida",
      "any.required": "La descripcion es obligatoria",
    }),
  resumen: noticeSummarySchema,
  estado: Joi.string()
    .valid("BORRADOR", "PUBLICADO")
    .required()
    .messages({
      "any.only": "El estado debe ser: BORRADOR o PUBLICADO",
      "any.required": "El estado es obligatorio",
    }),
  publico: Joi.boolean()
    .required()
    .messages({
      "boolean.base": "El campo publico debe ser booleano",
      "any.required": "El campo publico es obligatorio",
    }),
  id_user: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": "El id_user debe ser un numero",
      "number.positive": "El id_user debe ser positivo",
      "any.required": "El id_user es obligatorio",
    }),
}).unknown(false);

export const noticeQueryValidation = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": "El id debe ser un numero",
      "number.positive": "El id debe ser positivo",
      "any.required": "El id es obligatorio",
    }),
}).unknown(false);

export const noticeUpdateBodyValidation = Joi.object({
  titulo: Joi.string()
    .max(255)
    .trim()
    .messages({
      "string.max": "El titulo no puede exceder 255 caracteres",
    }),
  descripcion: Joi.string().trim(),
  resumen: noticeSummarySchema,
  estado: Joi.string()
    .valid("BORRADOR", "PUBLICADO", "ARCHIVADO")
    .messages({
      "any.only": "El estado debe ser: BORRADOR, PUBLICADO o ARCHIVADO",
    }),
  publico: Joi.boolean().messages({
    "boolean.base": "El campo publico debe ser booleano",
  }),
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

export const publicNoticeListValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(20).optional(),
}).unknown(false);

export const publicNoticeSlugValidation = Joi.object({
  slug: Joi.string()
    .trim()
    .min(1)
    .max(255)
    .pattern(/^[a-z0-9-]+$/)
    .required()
    .messages({
      "string.pattern.base": "El slug indicado no es valido.",
      "any.required": "El slug es obligatorio.",
    }),
}).unknown(false);

export const noticeAssetPreviewValidation = Joi.object({
  assetUuid: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "El identificador del asset no es valido.",
      "any.required": "El asset es obligatorio.",
    }),
}).unknown(false);

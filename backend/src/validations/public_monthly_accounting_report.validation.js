"use strict";

import Joi from "joi";

const publicMonthlyAccountingReportStatusValues = ["BORRADOR", "PUBLICADO", "ARCHIVADO"];

const numericIdSchema = Joi.number().integer().min(1).required().messages({
  "number.base": "id debe ser numerico.",
  "number.integer": "id debe ser un entero.",
  "number.min": "id debe ser mayor a 0.",
  "any.required": "id es obligatorio.",
});

export const publicMonthlyAccountingReportGenerateValidation = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).required().messages({
    "number.base": "year debe ser numerico.",
    "number.integer": "year debe ser un entero.",
    "number.min": "year debe ser mayor o igual a 2020.",
    "number.max": "year debe ser menor o igual a 2100.",
    "any.required": "year es obligatorio.",
  }),
  month: Joi.number().integer().min(1).max(12).required().messages({
    "number.base": "month debe ser numerico.",
    "number.integer": "month debe ser un entero.",
    "number.min": "month debe estar entre 1 y 12.",
    "number.max": "month debe estar entre 1 y 12.",
    "any.required": "month es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales al generar el informe publico.",
  });

export const publicMonthlyAccountingReportIdValidation = Joi.object({
  id: numericIdSchema,
})
  .unknown(false);

export const publicMonthlyAccountingReportListValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().trim().uppercase().valid(...publicMonthlyAccountingReportStatusValues).optional(),
  year: Joi.number().integer().min(2020).max(2100).optional(),
  month: Joi.number().integer().min(1).max(12).optional(),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en la lista de informes publicos.",
  });

export const publicMonthlyAccountingPublishedListValidation = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en la lista publica de informes contables.",
  });

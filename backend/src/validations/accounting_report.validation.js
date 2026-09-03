"use strict";

import Joi from "joi";
import {
  ACCOUNTING_REPORT_TRANSACTION_STATES,
  ACCOUNTING_REPORT_TRANSACTION_TYPES,
} from "../services/financialConcept/accounting_report.service.js";
import {
  reportCurrencySchema,
  reportDateRangeSchema,
  reportFormatSchema,
  reportIdSchema,
  reportSearchSchema,
} from "./report.validation.js";

const accountingTransactionsReportBaseSchema = {
  fecha_desde: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, "").optional(),
  fecha_hasta: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, "").optional(),
  moneda: reportCurrencySchema.allow(null, "").optional(),
  search: reportSearchSchema.optional(),
  tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...ACCOUNTING_REPORT_TRANSACTION_TYPES)
    .optional()
    .messages({
      "any.only":
        `El tipo del informe debe ser uno de: ${ACCOUNTING_REPORT_TRANSACTION_TYPES.join(", ")}.`,
    }),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...ACCOUNTING_REPORT_TRANSACTION_STATES)
    .optional()
    .messages({
      "any.only":
        `El estado del informe debe ser uno de: ${ACCOUNTING_REPORT_TRANSACTION_STATES.join(", ")}.`,
    }),
  categoria_id: reportIdSchema("categoria_id").optional(),
  proveedor_pago_id: reportIdSchema("proveedor_pago_id").optional(),
  origin: Joi.string().trim().uppercase().max(120).allow("", null).optional().messages({
    "string.max": "origin no puede superar 120 caracteres.",
  }),
};

function withDateRangeValidation(schema) {
  return schema.custom((value, helpers) => {
    const { error } = reportDateRangeSchema.validate({
      fecha_desde: value.fecha_desde,
      fecha_hasta: value.fecha_hasta,
    });

    if (error) {
      return helpers.message(error.message);
    }

    return value;
  });
}

export const accountingTransactionsReportPreviewValidation = withDateRangeValidation(
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    ...accountingTransactionsReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query del informe contable.",
  });

export const accountingTransactionsReportExportValidation = withDateRangeValidation(
  Joi.object({
    format: reportFormatSchema.required().messages({
      "any.required": "format es obligatorio.",
    }),
    page: Joi.any().forbidden().messages({
      "any.forbidden": "page no se permite en exportacion.",
    }),
    limit: Joi.any().forbidden().messages({
      "any.forbidden": "limit no se permite en exportacion.",
    }),
    ...accountingTransactionsReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query de exportacion del informe contable.",
  });

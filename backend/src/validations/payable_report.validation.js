"use strict";

import Joi from "joi";
import { PAYABLE_REPORT_STATES } from "../services/financialConcept/payable_report.service.js";
import {
  reportBooleanSchema,
  reportCurrencySchema,
  reportDateRangeSchema,
  reportFormatSchema,
  reportIdSchema,
  reportSearchSchema,
} from "./report.validation.js";

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

const payableReportBaseSchema = {
  fecha_emision_desde: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow("", null).optional()
    .messages({
      "string.pattern.base": "fecha_emision_desde debe tener formato YYYY-MM-DD.",
    }),
  fecha_emision_hasta: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow("", null).optional()
    .messages({
      "string.pattern.base": "fecha_emision_hasta debe tener formato YYYY-MM-DD.",
    }),
  vencimiento_desde: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow("", null).optional()
    .messages({
      "string.pattern.base": "vencimiento_desde debe tener formato YYYY-MM-DD.",
    }),
  vencimiento_hasta: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow("", null).optional()
    .messages({
      "string.pattern.base": "vencimiento_hasta debe tener formato YYYY-MM-DD.",
    }),
  estado: Joi.string()
    .trim()
    .uppercase()
    .valid(...PAYABLE_REPORT_STATES)
    .optional()
    .messages({
      "any.only": `El estado del informe debe ser uno de: ${PAYABLE_REPORT_STATES.join(", ")}.`,
    }),
  proveedor_id: reportIdSchema("proveedor_id").optional(),
  clinica_id: reportIdSchema("clinica_id").optional(),
  categoria_id: reportIdSchema("categoria_id").optional(),
  origen_tipo: Joi.string().trim().uppercase().max(120).allow("", null).optional().messages({
    "string.max": "origen_tipo no puede superar 120 caracteres.",
  }),
  moneda: reportCurrencySchema.allow("", null).optional(),
  solo_vencidas: reportBooleanSchema.optional(),
  con_saldo: reportBooleanSchema.optional(),
  search: reportSearchSchema.optional(),
};

function withPayableDateRanges(schema) {
  return schema.custom((value, helpers) => {
    const emissionRange = reportDateRangeSchema.validate({
      fecha_desde: value.fecha_emision_desde,
      fecha_hasta: value.fecha_emision_hasta,
    });
    if (emissionRange.error) {
      return helpers.message(emissionRange.error.message.replace("fecha_desde", "fecha_emision_desde").replace("fecha_hasta", "fecha_emision_hasta"));
    }

    const dueRange = reportDateRangeSchema.validate({
      fecha_desde: value.vencimiento_desde,
      fecha_hasta: value.vencimiento_hasta,
    });
    if (dueRange.error) {
      return helpers.message(dueRange.error.message.replace("fecha_desde", "vencimiento_desde").replace("fecha_hasta", "vencimiento_hasta"));
    }

    return value;
  });
}

export const payableReportPreviewValidation = withPayableDateRanges(
  Joi.object({
    page: paginationSchema.extract("page"),
    limit: paginationSchema.extract("limit"),
    ...payableReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query del informe de cuentas por pagar.",
  });

export const payableReportExportValidation = withPayableDateRanges(
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
    ...payableReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query de exportacion del informe de cuentas por pagar.",
  });

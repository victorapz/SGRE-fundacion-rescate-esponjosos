"use strict";

import Joi from "joi";
import {
  REPORT_FORMATS,
  REPORT_MAX_DATE_RANGE_DAYS,
  REPORT_PREVIEW_DEFAULT_LIMIT,
  REPORT_PREVIEW_MAX_LIMIT,
  REPORT_SUPPORTED_CURRENCIES,
} from "../services/reporting/report.constants.js";
import { parseReportDate } from "../services/reporting/report.shared.js";

export const reportDateSchema = Joi.string()
  .trim()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    try {
      parseReportDate(value);
      return value;
    } catch (error) {
      return helpers.message(error.message);
    }
  })
  .messages({
    "string.base": "La fecha del informe debe ser de tipo string.",
    "string.empty": "La fecha del informe no puede estar vacia.",
    "string.pattern.base": "La fecha del informe debe tener formato YYYY-MM-DD.",
  });

export const reportIdSchema = (label = "El id del informe") =>
  Joi.number().integer().positive().messages({
    "number.base": `${label} debe ser un numero.`,
    "number.integer": `${label} debe ser un numero entero.`,
    "number.positive": `${label} debe ser un numero positivo.`,
  });

export const reportBooleanSchema = Joi.boolean().messages({
  "boolean.base": "El filtro booleano del informe debe ser verdadero o falso.",
});

export const reportSearchSchema = Joi.string()
  .trim()
  .max(255)
  .allow("", null)
  .messages({
    "string.base": "La busqueda del informe debe ser de tipo string.",
    "string.max": "La busqueda del informe no puede superar 255 caracteres.",
  });

export const reportCurrencySchema = Joi.string()
  .trim()
  .uppercase()
  .valid(...REPORT_SUPPORTED_CURRENCIES)
  .messages({
    "string.base": "La moneda del informe debe ser de tipo string.",
    "any.only": `La moneda del informe debe ser una de: ${REPORT_SUPPORTED_CURRENCIES.join(", ")}.`,
  });

export const reportFormatSchema = Joi.string()
  .trim()
  .lowercase()
  .valid(...REPORT_FORMATS)
  .messages({
    "string.base": "El formato del informe debe ser de tipo string.",
    "any.only": `El formato del informe debe ser uno de: ${REPORT_FORMATS.join(", ")}.`,
  });

export const reportPaginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "page debe ser numerico.",
    "number.integer": "page debe ser un entero.",
    "number.min": "page debe ser mayor o igual a 1.",
  }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(REPORT_PREVIEW_MAX_LIMIT)
    .default(REPORT_PREVIEW_DEFAULT_LIMIT)
    .messages({
      "number.base": "limit debe ser numerico.",
      "number.integer": "limit debe ser un entero.",
      "number.min": "limit debe ser mayor o igual a 1.",
      "number.max": `limit no puede superar ${REPORT_PREVIEW_MAX_LIMIT}.`,
    }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en la paginacion del informe.",
  });

export const reportDateRangeSchema = Joi.object({
  fecha_desde: reportDateSchema.allow(null, "").optional(),
  fecha_hasta: reportDateSchema.allow(null, "").optional(),
})
  .custom((value, helpers) => {
    const hasFrom = Boolean(value.fecha_desde);
    const hasTo = Boolean(value.fecha_hasta);

    if (!hasFrom && !hasTo) {
      return value;
    }

    try {
      const from = hasFrom ? parseReportDate(value.fecha_desde).isoDate : null;
      const to = hasTo ? parseReportDate(value.fecha_hasta).isoDate : null;

      if (from && to && from > to) {
        return helpers.message("fecha_desde no puede ser mayor que fecha_hasta.");
      }

      if (from && to) {
        const fromMs = Date.UTC(
          Number(from.slice(0, 4)),
          Number(from.slice(5, 7)) - 1,
          Number(from.slice(8, 10)),
        );
        const toMs = Date.UTC(
          Number(to.slice(0, 4)),
          Number(to.slice(5, 7)) - 1,
          Number(to.slice(8, 10)),
        );
        const rangeDays = Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1;

        if (rangeDays > REPORT_MAX_DATE_RANGE_DAYS) {
          return helpers.message(
            `El rango del informe no puede superar ${REPORT_MAX_DATE_RANGE_DAYS} dias.`,
          );
        }
      }

      return value;
    } catch (error) {
      return helpers.message(error.message);
    }
  })
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en el rango de fechas del informe.",
  });

export const reportPreviewQueryValidation = Joi.object({
  page: reportPaginationSchema.extract("page"),
  limit: reportPaginationSchema.extract("limit"),
  fecha_desde: reportDateSchema.allow(null, "").optional(),
  fecha_hasta: reportDateSchema.allow(null, "").optional(),
  moneda: reportCurrencySchema.allow(null, "").optional(),
  search: reportSearchSchema.optional(),
})
  .custom((value, helpers) => {
    const { error } = reportDateRangeSchema.validate({
      fecha_desde: value.fecha_desde,
      fecha_hasta: value.fecha_hasta,
    });

    if (error) {
      return helpers.message(error.message);
    }

    return value;
  })
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales en la query del informe.",
  });

export const reportExportQueryValidation = reportPreviewQueryValidation.keys({
  format: reportFormatSchema.required().messages({
    "any.required": "format es obligatorio.",
  }),
});

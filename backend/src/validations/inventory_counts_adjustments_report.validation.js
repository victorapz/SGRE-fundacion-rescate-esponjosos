"use strict";

import Joi from "joi";
import {
  INVENTORY_ADJUSTMENT_REPORT_TYPES,
  PHYSICAL_COUNT_DIFFERENCE_CLASSIFICATIONS,
} from "../services/inventoryConcept/inventory_counts_adjustments_report.service.js";
import {
  reportBooleanSchema,
  reportDateSchema,
  reportFormatSchema,
  reportIdSchema,
  reportSearchSchema,
} from "./report.validation.js";

const inventoryCountsAdjustmentsReportBaseSchema = {
  fecha_desde: reportDateSchema.allow(null, "").optional(),
  fecha_hasta: reportDateSchema.allow(null, "").optional(),
  ubicacion_id: reportIdSchema("ubicacion_id").optional(),
  item_id: reportIdSchema("item_id").optional(),
  categoria_id: reportIdSchema("categoria_id").optional(),
  responsable_id: reportIdSchema("responsable_id").optional(),
  estado_ajuste: Joi.string()
    .trim()
    .uppercase()
    .valid("PENDIENTE", "APLICADO", "CANCELADO")
    .optional()
    .messages({
      "any.only": "estado_ajuste debe ser uno de: PENDIENTE, APLICADO, CANCELADO.",
    }),
  con_diferencias: reportBooleanSchema.optional(),
  clasificacion_diferencia: Joi.string()
    .trim()
    .uppercase()
    .valid(...PHYSICAL_COUNT_DIFFERENCE_CLASSIFICATIONS)
    .optional()
    .messages({
      "any.only":
        `clasificacion_diferencia debe ser una de: ${PHYSICAL_COUNT_DIFFERENCE_CLASSIFICATIONS.join(", ")}.`,
    }),
  con_ajuste: reportBooleanSchema.optional(),
  ajuste_tipo: Joi.string()
    .trim()
    .uppercase()
    .valid(...INVENTORY_ADJUSTMENT_REPORT_TYPES)
    .optional()
    .messages({
      "any.only": `ajuste_tipo debe ser uno de: ${INVENTORY_ADJUSTMENT_REPORT_TYPES.join(", ")}.`,
    }),
  search: reportSearchSchema.optional(),
};

function withCountsAdjustmentsRules(schema) {
  return schema.custom((value, helpers) => {
    if (value.fecha_desde && value.fecha_hasta && value.fecha_desde > value.fecha_hasta) {
      return helpers.message("fecha_desde no puede ser mayor que fecha_hasta.");
    }

    if (
      value.clasificacion_diferencia === "SIN_DIFERENCIA"
      && value.ajuste_tipo
    ) {
      return helpers.message(
        "clasificacion_diferencia=SIN_DIFERENCIA entra en conflicto con ajuste_tipo.",
      );
    }

    if (
      value.con_diferencias === false
      && value.clasificacion_diferencia
      && value.clasificacion_diferencia !== "SIN_DIFERENCIA"
    ) {
      return helpers.message(
        "con_diferencias=false entra en conflicto con una clasificacion_diferencia distinta de SIN_DIFERENCIA.",
      );
    }

    return value;
  });
}

export const inventoryCountsAdjustmentsReportPreviewValidation = withCountsAdjustmentsRules(
  Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      "number.base": "page debe ser numerico.",
      "number.integer": "page debe ser un entero.",
      "number.min": "page debe ser mayor o igual a 1.",
    }),
    limit: Joi.number().integer().min(1).max(200).default(50).messages({
      "number.base": "limit debe ser numerico.",
      "number.integer": "limit debe ser un entero.",
      "number.min": "limit debe ser mayor o igual a 1.",
      "number.max": "limit no puede superar 200.",
    }),
    ...inventoryCountsAdjustmentsReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query del informe de conteos y ajustes.",
  });

export const inventoryCountsAdjustmentsReportExportValidation = withCountsAdjustmentsRules(
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
    ...inventoryCountsAdjustmentsReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query de exportacion del informe de conteos y ajustes.",
  });

"use strict";

import Joi from "joi";
import {
  INVENTORY_EXISTENCE_REPORT_STOCK_STATES,
} from "../services/inventoryConcept/inventory_existence_report.service.js";
import {
  reportBooleanSchema,
  reportFormatSchema,
  reportIdSchema,
  reportSearchSchema,
} from "./report.validation.js";

const inventoryExistenceReportBaseSchema = {
  categoria_id: reportIdSchema("categoria_id").optional(),
  ubicacion_id: reportIdSchema("ubicacion_id").optional(),
  item_id: reportIdSchema("item_id").optional(),
  unidad_id: reportIdSchema("unidad_id").optional(),
  estado_stock: Joi.string()
    .trim()
    .uppercase()
    .valid(...INVENTORY_EXISTENCE_REPORT_STOCK_STATES)
    .optional()
    .messages({
      "any.only":
        `El estado_stock del informe debe ser uno de: ${INVENTORY_EXISTENCE_REPORT_STOCK_STATES.join(", ")}.`,
    }),
  solo_sin_stock: reportBooleanSchema.optional(),
  solo_bajo_minimo: reportBooleanSchema.optional(),
  activo: reportBooleanSchema.optional(),
  search: reportSearchSchema.optional(),
};

function withInventoryExistenceRules(schema) {
  return schema.custom((value, helpers) => {
    if (value.solo_sin_stock === true && value.solo_bajo_minimo === true) {
      return helpers.message(
        "solo_sin_stock y solo_bajo_minimo no pueden ser true al mismo tiempo.",
      );
    }

    if (value.estado_stock && value.solo_sin_stock === true && value.estado_stock !== "SIN_STOCK") {
      return helpers.message(
        "solo_sin_stock=true entra en conflicto con estado_stock distinto de SIN_STOCK.",
      );
    }

    if (
      value.estado_stock
      && value.solo_bajo_minimo === true
      && value.estado_stock !== "BAJO_MINIMO"
    ) {
      return helpers.message(
        "solo_bajo_minimo=true entra en conflicto con estado_stock distinto de BAJO_MINIMO.",
      );
    }

    return value;
  });
}

export const inventoryExistenceReportPreviewValidation = withInventoryExistenceRules(
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
    ...inventoryExistenceReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query del informe de existencias.",
  });

export const inventoryExistenceReportExportValidation = withInventoryExistenceRules(
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
    ...inventoryExistenceReportBaseSchema,
  }),
)
  .unknown(false)
  .messages({
    "object.unknown":
      "No se permiten propiedades adicionales en la query de exportacion del informe de existencias.",
  });

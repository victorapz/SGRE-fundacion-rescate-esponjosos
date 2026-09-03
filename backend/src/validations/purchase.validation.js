"use strict";

import Joi from "joi";
import {
  idSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";
import {
  currencySchema,
  financialNoteSchema,
  moneyAmountSchema,
  paymentDueDateSchema,
} from "./financial.shared.validation.js";

const estadoSchema = Joi.string()
  .valid("BORRADOR", "CONFIRMADA", "CANCELADA")
  .messages({
    "any.only": "El estado no es valido.",
    "string.base": "El estado debe ser de tipo string.",
  });

const estadoPagoSchema = Joi.string()
  .valid("PENDIENTE", "PAGADA", "PAGADA_PARCIAL")
  .messages({
    "any.only": "El estado de pago no es valido.",
    "string.base": "El estado de pago debe ser de tipo string.",
  });

const withDateConsistency = (value, helpers) => {
  if (
    value.fecha_recepcion
    && value.fecha_compra
    && new Date(value.fecha_recepcion) < new Date(value.fecha_compra)
  ) {
    return helpers.message(
      "La fecha de recepcion no puede ser anterior a la fecha de compra.",
    );
  }

  if (value.estado_pago === "PAGADA_PARCIAL") {
    return helpers.message(
      "No se puede registrar una compra PAGADA_PARCIAL sin un monto pagado inicial explicito.",
    );
  }

  return value;
};

export const purchaseQueryValidation = Joi.object({
  compra_id: idSchema("compra_id").required().messages({
    "any.required": "compra_id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const purchaseCreateValidation = Joi.object({
  fecha_compra: isoDateSchema("La fecha de compra").required().messages({
    "any.required": "La fecha de compra es obligatoria.",
  }),
  fecha_recepcion: optionalIsoDateSchema("La fecha de recepcion"),
  moneda: currencySchema("La moneda").default("CLP"),
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  descripcion: optionalTextSchema("La descripcion"),
  observaciones: optionalTextSchema("Las observaciones"),
  supplier_id: idSchema("supplier_id").required().messages({
    "any.required": "supplier_id es obligatorio.",
  }),
  registered_by_id: idSchema("registered_by_id").optional(),
})
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const purchaseUpdateBodyValidation = Joi.object({
  fecha_compra: isoDateSchema("La fecha de compra"),
  fecha_recepcion: optionalIsoDateSchema("La fecha de recepcion"),
  moneda: currencySchema("La moneda"),
  fecha_vencimiento_pago: paymentDueDateSchema(),
  observacion_financiera: financialNoteSchema(),
  descripcion: optionalTextSchema("La descripcion"),
  observaciones: optionalTextSchema("Las observaciones"),
  supplier_id: idSchema("supplier_id"),
  registered_by_id: idSchema("registered_by_id").optional(),
})
  .or(
    "fecha_compra",
    "fecha_recepcion",
    "moneda",
    "fecha_vencimiento_pago",
    "observacion_financiera",
    "descripcion",
    "observaciones",
    "supplier_id",
    "registered_by_id",
  )
  .custom(withDateConsistency)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
  });

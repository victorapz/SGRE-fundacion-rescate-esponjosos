"use strict";

import Joi from "joi";

export const SUPPORTED_FINANCIAL_CURRENCIES = ["CLP", "USD", "EUR"];

export const moneyAmountSchema = (label = "El monto") =>
  Joi.number().min(0).precision(2).messages({
    "number.base": `${label} debe ser un numero.`,
    "number.min": `${label} no puede ser negativo.`,
    "number.precision": `${label} debe tener como maximo 2 decimales.`,
  });

export const nullableMoneyAmountSchema = (label = "El monto") =>
  moneyAmountSchema(label).allow(null);

export const currencySchema = (label = "La moneda") =>
  Joi.string().trim().uppercase().valid(...SUPPORTED_FINANCIAL_CURRENCIES).allow(null, "").messages({
    "string.base": `${label} debe ser de tipo string.`,
    "any.only": `${label} debe ser una de las monedas permitidas: ${SUPPORTED_FINANCIAL_CURRENCIES.join(", ")}.`,
  });

export const payableFlagSchema = Joi.boolean().messages({
  "boolean.base": "El indicador de cuenta por pagar debe ser booleano.",
});

export const paymentDueDateSchema = (label = "La fecha de vencimiento de pago") =>
  Joi.date().iso().allow(null, "").messages({
    "date.base": `${label} debe ser una fecha valida.`,
    "date.format": `${label} debe tener formato ISO.`,
  });

export const financialNoteSchema = (label = "La observacion financiera", max = 5000) =>
  Joi.string().trim().max(max).allow(null, "").messages({
    "string.base": `${label} debe ser de tipo string.`,
    "string.max": `${label} debe tener como maximo ${max} caracteres.`,
  });

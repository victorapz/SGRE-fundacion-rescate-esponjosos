"use strict";

import Joi from "joi";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const LOCALIZED_DECIMAL_PATTERN = /^[-+]?\d+(?:[.,]\d+)?$/;

function normalizeLocalizedDecimal(value, helpers, {
  label = "El valor",
  required = false,
  maxDecimals = null,
} = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) {
      return helpers.message(`${label} es obligatorio.`);
    }

    return null;
  }

  const normalized = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  if (!LOCALIZED_DECIMAL_PATTERN.test(String(value).trim())) {
    return helpers.message("Ingresa un valor numerico valido.");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return helpers.message("Ingresa un valor numerico valido.");
  }

  if (maxDecimals !== null) {
    const decimalPart = normalized.split(".")[1] || "";
    if (decimalPart.length > maxDecimals) {
      return helpers.message(`${label} debe tener como maximo ${maxDecimals} decimales.`);
    }
  }

  return parsed;
}

function normalizeDate(value, helpers, { required = false, label = "La fecha" } = {}) {
  if (value === undefined || value === null || String(value).trim() === "") {
    if (required) {
      return helpers.message(`${label} es obligatoria.`);
    }

    return null;
  }

  const normalized = String(value).trim();
  if (!DATE_FORMAT.test(normalized)) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return helpers.message("Revisa las fechas ingresadas.");
  }

  return normalized;
}

export const positiveIdSchema = (label = "El id") =>
  Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      "number.base": `${label} debe ser un numero.`,
      "number.integer": `${label} debe ser un numero entero.`,
      "number.positive": `${label} debe ser un numero positivo.`,
      "any.required": `${label} es obligatorio.`,
    });

export const localizedDecimalSchema = (
  label = "El valor",
  { required = false, maxDecimals = null } = {},
) =>
  Joi.any().custom((value, helpers) =>
    normalizeLocalizedDecimal(value, helpers, {
      label,
      required,
      maxDecimals,
    }));

export const localizedMoneyAmountSchema = (label = "El monto", {
  required = false,
} = {}) =>
  localizedDecimalSchema(label, {
    required,
    maxDecimals: 2,
  }).custom((value, helpers) => {
    if (value === null) {
      return required ? helpers.message(`${label} es obligatorio.`) : null;
    }

    if (value < 0) {
      return helpers.message(`${label} no puede ser negativo.`);
    }

    return value;
  });

export const localDateSchema = (label = "La fecha", { required = false } = {}) =>
  Joi.any()
    .custom((value, helpers) => normalizeDate(value, helpers, { required, label }));

export const nullableIdSchema = Joi.alternatives()
  .try(
    Joi.number().integer().positive(),
    Joi.string().trim().pattern(/^\d+$/),
    Joi.valid(null, ""),
  )
  .custom((value, helpers) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return helpers.message("El id debe ser un numero positivo.");
    }

    return parsed;
  });

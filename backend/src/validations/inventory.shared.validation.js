"use strict";

import Joi from "joi";

export const idSchema = (label = "El id") =>
  Joi.number().integer().positive().messages({
    "number.base": `${label} debe ser un numero.`,
    "number.integer": `${label} debe ser un numero entero.`,
    "number.positive": `${label} debe ser un numero positivo.`,
  });

export const positiveNumberSchema = (label) =>
  Joi.number().positive().messages({
    "number.base": `${label} debe ser un numero.`,
    "number.positive": `${label} debe ser mayor a 0.`,
  });

export const nonNegativeNumberSchema = (label) =>
  Joi.number().min(0).messages({
    "number.base": `${label} debe ser un numero.`,
    "number.min": `${label} no puede ser negativo.`,
  });

export const requiredTextSchema = (label, max = 5000) =>
  Joi.string().trim().min(1).max(max).messages({
    "string.base": `${label} debe ser de tipo string.`,
    "string.empty": `${label} no puede estar vacio.`,
    "string.min": `${label} debe tener al menos 1 caracter.`,
    "string.max": `${label} debe tener como maximo ${max} caracteres.`,
  });

export const optionalTextSchema = (label = "Este campo", max = 5000) =>
  Joi.string().trim().max(max).allow(null, "").messages({
    "string.base": `${label} debe ser de tipo string.`,
    "string.max": `${label} debe tener como maximo ${max} caracteres.`,
  });

export const isoDateSchema = (label) =>
  Joi.date().iso().messages({
    "date.base": `${label} debe ser una fecha valida.`,
    "date.format": `${label} debe tener formato ISO.`,
  });

export const optionalIsoDateSchema = (label) =>
  isoDateSchema(label).allow(null, "");

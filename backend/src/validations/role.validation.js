"use strict";

import Joi from "joi";

export const roleCreateValidation = Joi.object({
	nombre: Joi.string()
		.required()
		.trim()
		.max(255)
		.messages({
			"string.base": "El nombre del rol debe ser un texto",
			"string.empty": "El nombre del rol es obligatorio",
			"string.max": "El nombre del rol no puede exceder 255 caracteres",
			"any.required": "El nombre del rol es obligatorio",
		}),
	permisos: Joi.array()
		.items(Joi.number().integer().positive())
		.min(1)
		.required()
		.messages({
			"array.base": "Los permisos deben ser un listado",
			"array.min": "Debes seleccionar al menos un permiso",
			"any.required": "Los permisos son obligatorios",
		}),
});

export const roleQueryValidation = Joi.object({
	id: Joi.number()
		.integer()
		.positive()
		.required()
		.messages({
			"number.base": "El id debe ser un numero",
			"number.integer": "El id debe ser un numero entero",
			"number.positive": "El id debe ser mayor a 0",
			"any.required": "El id es obligatorio",
		}),
});

export const roleUpdateBodyValidation = Joi.object({
	nombre: Joi.string()
		.trim()
		.max(255)
		.messages({
			"string.base": "El nombre del rol debe ser un texto",
			"string.max": "El nombre del rol no puede exceder 255 caracteres",
		}),
	permisos: Joi.array()
		.items(Joi.number().integer().positive())
		.min(1)
		.messages({
			"array.base": "Los permisos deben ser un listado",
			"array.min": "Debes seleccionar al menos un permiso",
		}),
})
	.min(1)
	.messages({
		"object.min": "Debes enviar al menos un campo para actualizar",
	});

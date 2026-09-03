"use strict";

import Joi from "joi";

const idSchema = Joi.number().integer().positive().messages({
  "number.base": "El id debe ser un numero.",
  "number.integer": "El id debe ser un numero entero.",
  "number.positive": "El id debe ser un numero positivo.",
});

const statusSchema = Joi.string()
  .valid("INSCRITO", "PRESENTE", "AUSENTE", "CANCELADO")
  .messages({
    "any.only": "El estado debe ser INSCRITO, PRESENTE, AUSENTE o CANCELADO.",
    "string.base": "El estado debe ser un texto.",
  });

const attendanceSchema = Joi.string()
  .valid("PRESENTE", "AUSENTE")
  .messages({
    "any.only": "La asistencia debe ser PRESENTE o AUSENTE.",
    "string.base": "La asistencia debe ser un texto.",
  });

const bitacoraSchema = Joi.string()
  .min(40)
  .messages({
    "string.min": "La bitacora debe tener al menos 40 caracteres.",
    "string.base": "La bitacora debe ser un texto.",
  });

export const registrationShiftParamsValidation = Joi.object({
  shiftId: idSchema.required().messages({
    "any.required": "shiftId es obligatorio.",
  }),
  userId: idSchema.required().messages({
    "any.required": "userId es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftByShiftValidation = Joi.object({
  shiftId: idSchema.required().messages({
    "any.required": "shiftId es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftByUserValidation = Joi.object({
  userId: idSchema.required().messages({
    "any.required": "userId es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftIdValidation = Joi.object({
  registrationId: idSchema.required().messages({
    "any.required": "registrationId es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftStatusValidation = Joi.object({
  estado: statusSchema.required().messages({
    "any.required": "estado es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftAttendanceValidation = Joi.object({
  estado: attendanceSchema.required().messages({
    "any.required": "estado es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const registrationShiftBitacoraValidation = Joi.object({
  bitacora: bitacoraSchema.required().messages({
    "any.required": "bitacora es obligatoria.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

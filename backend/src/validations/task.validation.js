"use strict";

import Joi from "joi";

const taskStatusSchema = Joi.string()
  .valid("pendiente", "en_progreso", "completada", "archivada")
  .messages({
    "any.only": "El estado debe ser: pendiente, en_progreso, completada o archivada",
  });

const assignmentStatusSchema = Joi.string()
  .valid("pendiente", "en_progreso", "completada")
  .messages({
    "any.only": "El estado debe ser: pendiente, en_progreso o completada",
  });

const positiveId = Joi.number()
  .integer()
  .positive()
  .messages({
    "number.base": "El valor debe ser un número",
    "number.integer": "El valor debe ser un número entero",
    "number.positive": "El valor debe ser positivo",
  });

export const taskCreateValidation = Joi.object({
  titulo: Joi.string()
    .required()
    .max(255)
    .trim()
    .messages({
      "string.empty": "El título es requerido",
      "string.max": "El título no puede exceder 255 caracteres",
      "any.required": "El título es obligatorio",
    }),
  descripcion: Joi.string()
    .required()
    .trim()
    .messages({
      "string.empty": "La descripción es requerida",
      "any.required": "La descripción es obligatoria",
    }),
  prioridad: Joi.string()
    .valid("baja", "media", "alta")
    .required()
    .messages({
      "any.only": "La prioridad debe ser: baja, media o alta",
      "any.required": "La prioridad es obligatoria",
    }),
  fecha_limite: Joi.date()
    .iso()
    .greater("now")
    .required()
    .messages({
      "date.base": "La fecha límite debe ser una fecha válida",
      "date.format": "La fecha límite debe estar en formato ISO 8601",
      "date.greater": "La fecha límite debe ser posterior a la fecha actual",
      "any.required": "La fecha límite es obligatoria",
    }),
  area_id: positiveId,
  usuarios_asignados: Joi.array()
    .items(positiveId)
    .unique()
    .messages({
      "array.base": "usuarios_asignados debe ser una lista de ids",
    }),
});

export const taskQueryValidation = Joi.object({
  id: positiveId.required().messages({
    "any.required": "El id es obligatorio",
  }),
});

export const taskUpdateBodyValidation = Joi.object({
  titulo: Joi.string().max(255).trim().messages({
    "string.max": "El título no puede exceder 255 caracteres",
  }),
  descripcion: Joi.string().trim(),
  prioridad: Joi.string().valid("baja", "media", "alta").messages({
    "any.only": "La prioridad debe ser: baja, media o alta",
  }),
  fecha_limite: Joi.date().iso().greater("now").messages({
    "date.base": "La fecha límite debe ser una fecha válida",
    "date.format": "La fecha límite debe estar en formato ISO 8601",
    "date.greater": "La fecha límite debe ser posterior a la fecha actual",
  }),
  area_id: positiveId,
  usuarios_asignados: Joi.array()
    .items(positiveId)
    .unique()
    .messages({
      "array.base": "usuarios_asignados debe ser una lista de ids",
    }),
})
  .min(1)
  .messages({
    "object.min": "Debe proporcionar al menos un campo para actualizar",
  });

export const taskListQueryValidation = Joi.object({
  view: Joi.string()
    .valid("all", "assigned", "created", "archived")
    .messages({
      "any.only": "El filtro view debe ser: all, assigned, created o archived",
    }),
  estado: taskStatusSchema,
  prioridad: Joi.string()
    .valid("baja", "media", "alta")
    .messages({
      "any.only": "La prioridad debe ser: baja, media o alta",
    }),
  creatorId: positiveId,
  assigneeId: positiveId,
  dueFrom: Joi.date().iso().messages({
    "date.base": "dueFrom debe ser una fecha válida",
    "date.format": "dueFrom debe estar en formato ISO 8601",
  }),
  dueTo: Joi.date().iso().messages({
    "date.base": "dueTo debe ser una fecha válida",
    "date.format": "dueTo debe estar en formato ISO 8601",
  }),
});

export const taskAssignmentStatusQueryValidation = Joi.object({
  assignmentId: positiveId.required().messages({
    "any.required": "El assignmentId es obligatorio",
  }),
});

export const taskAssignmentStatusBodyValidation = Joi.object({
  estado: assignmentStatusSchema.required().messages({
    "any.required": "El estado es obligatorio",
  }),
  comentario: Joi.string().trim().allow("").max(2000).messages({
    "string.max": "El comentario no puede exceder 2000 caracteres",
  }),
});

export const taskCommentCreateValidation = Joi.object({
  taskId: positiveId.required().messages({
    "any.required": "El taskId es obligatorio",
  }),
  tipo: Joi.string().valid("general", "assignment").required().messages({
    "any.only": "El tipo de comentario debe ser general o assignment",
    "any.required": "El tipo de comentario es obligatorio",
  }),
  assignmentId: positiveId.allow(null),
  comentario: Joi.string()
    .trim()
    .required()
    .max(4000)
    .messages({
      "string.empty": "El comentario es obligatorio",
      "string.max": "El comentario no puede exceder 4000 caracteres",
      "any.required": "El comentario es obligatorio",
    }),
}).custom((value, helpers) => {
  if (value.tipo === "general" && value.assignmentId) {
    return helpers.message("Los comentarios generales no deben incluir assignmentId");
  }

  if (value.tipo === "assignment" && !value.assignmentId) {
    return helpers.message("Los comentarios de asignación requieren assignmentId");
  }

  return value;
});

export const taskCommentListValidation = Joi.object({
  taskId: positiveId.required().messages({
    "any.required": "El taskId es obligatorio",
  }),
});

export const taskHistoryListValidation = Joi.object({
  taskId: positiveId.required().messages({
    "any.required": "El taskId es obligatorio",
  }),
});

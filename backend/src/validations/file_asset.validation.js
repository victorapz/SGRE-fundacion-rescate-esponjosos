"use strict";

import Joi from "joi";
import {
  FILE_ASSET_CONTEXT_RULES,
  FILE_ASSET_CONTEXTS,
  FILE_ASSET_ENTITY_TYPES,
  FILE_ASSET_STATUS,
  FILE_ASSET_VISIBILITY,
} from "../entities/file_asset.entity.js";
import {
  idSchema,
  optionalTextSchema,
} from "./inventory.shared.validation.js";

function parseBooleanInput(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false" || normalized === "") return false;
  }

  if (value === undefined || value === null) return false;
  return value;
}

const multipartBooleanSchema = Joi.alternatives()
  .try(
    Joi.boolean(),
    Joi.number().valid(0, 1),
    Joi.string().trim().valid("true", "false", "1", "0", ""),
  )
  .custom((value, helpers) => {
    const parsedValue = parseBooleanInput(value);

    if (typeof parsedValue !== "boolean") {
      return helpers.message("is_main debe ser booleano.");
    }

    return parsedValue;
  })
  .messages({
    "alternatives.match": "is_main debe ser booleano.",
    "boolean.base": "is_main debe ser booleano.",
    "number.base": "is_main debe ser booleano.",
    "string.base": "is_main debe ser booleano.",
  });

function validateContextPayload(value, helpers) {
  const entityType = value?.entity_type;
  const context = value?.context;
  const visibility = value?.visibility;

  if (!context) return value;

  const contextRule = FILE_ASSET_CONTEXT_RULES[context];
  if (!contextRule) {
    return helpers.message("El contexto indicado no es valido.");
  }

  if (entityType && !contextRule.entityTypes.includes(entityType)) {
    return helpers.message("El entity_type no es compatible con el contexto indicado.");
  }

  if (
    visibility === FILE_ASSET_VISIBILITY.PUBLICO
    && contextRule.allowPublic === false
  ) {
    return helpers.message("El contexto indicado solo admite archivos privados.");
  }

  return value;
}

const baseFileMetadataSchema = {
  entity_type: Joi.string()
    .valid(...Object.values(FILE_ASSET_ENTITY_TYPES))
    .required()
    .messages({
      "any.only": "entity_type no es valido.",
      "any.required": "entity_type es obligatorio.",
    }),
  entity_id: idSchema("entity_id").required().messages({
    "any.required": "entity_id es obligatorio.",
  }),
  context: Joi.string()
    .valid(...Object.values(FILE_ASSET_CONTEXTS))
    .required()
    .messages({
      "any.only": "context no es valido.",
      "any.required": "context es obligatorio.",
    }),
  visibility: Joi.string()
    .valid(...Object.values(FILE_ASSET_VISIBILITY))
    .required()
    .messages({
      "any.only": "visibility no es valido.",
      "any.required": "visibility es obligatorio.",
    }),
  title: optionalTextSchema("El titulo", 255),
  description: optionalTextSchema("La descripcion", 5000),
  is_main: multipartBooleanSchema.optional(),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "sort_order debe ser numerico.",
    "number.integer": "sort_order debe ser un numero entero.",
    "number.min": "sort_order no puede ser negativo.",
  }),
};

export const uploadFileValidation = Joi.object(baseFileMetadataSchema)
  .custom(validateContextPayload)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const listFilesValidation = Joi.object({
  entity_type: Joi.string()
    .valid(...Object.values(FILE_ASSET_ENTITY_TYPES))
    .optional()
    .messages({
      "any.only": "entity_type no es valido.",
    }),
  entity_id: idSchema("entity_id").optional(),
  context: Joi.string()
    .valid(...Object.values(FILE_ASSET_CONTEXTS))
    .optional()
    .messages({
      "any.only": "context no es valido.",
    }),
  visibility: Joi.string()
    .valid(...Object.values(FILE_ASSET_VISIBILITY))
    .optional()
    .messages({
      "any.only": "visibility no es valido.",
    }),
  status: Joi.string()
    .valid(...Object.values(FILE_ASSET_STATUS))
    .default(FILE_ASSET_STATUS.ACTIVO)
    .messages({
      "any.only": "status no es valido.",
    }),
})
  .custom(validateContextPayload)
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const updateFileMetadataValidation = Joi.object({
  title: optionalTextSchema("El titulo", 255),
  description: optionalTextSchema("La descripcion", 5000),
  sort_order: Joi.number().integer().min(0).optional().messages({
    "number.base": "sort_order debe ser numerico.",
    "number.integer": "sort_order debe ser un numero entero.",
    "number.min": "sort_order no puede ser negativo.",
  }),
  is_main: multipartBooleanSchema.optional(),
})
  .or("title", "description", "sort_order", "is_main")
  .unknown(false)
  .messages({
    "object.missing": "Debes proporcionar al menos un campo a actualizar.",
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const fileAssetIdParamValidation = Joi.object({
  id: idSchema("id").required().messages({
    "any.required": "id es obligatorio.",
  }),
})
  .unknown(false)
  .messages({
    "object.unknown": "No se permiten propiedades adicionales.",
  });

export const markAsMainValidation = fileAssetIdParamValidation;

export const deleteFileValidation = fileAssetIdParamValidation;

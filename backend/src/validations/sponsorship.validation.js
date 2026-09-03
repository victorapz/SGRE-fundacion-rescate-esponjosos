"use strict";

import Joi from "joi";
import {
  idSchema,
  optionalTextSchema,
  positiveNumberSchema,
  requiredTextSchema,
} from "./inventory.shared.validation.js";

const paginationSchema = {
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
};

const strictBooleanSchema = Joi.boolean().strict().messages({
  "boolean.base": "El valor booleano enviado no es valido.",
});

const emailSchema = Joi.string()
  .trim()
  .email({ tlds: { allow: false } })
  .max(255)
  .messages({
    "string.email": "El email no tiene un formato valido.",
    "string.max": "El email no puede exceder 255 caracteres.",
  });

const searchSchema = Joi.string().trim().max(255).allow("", null).optional();
const uuidSchema = Joi.string()
  .guid({ version: ["uuidv4", "uuidv5"] })
  .required();

const planStateSchema = Joi.boolean().optional();

const sponsorshipStateValues = [
  "PENDIENTE_APROBACION",
  "ACTIVO",
  "SUSPENDIDO",
  "CANCELADO",
  "FALLIDO",
];

const subscriptionStateValues = [
  "CREADA",
  "APROBACION_PENDIENTE",
  "ACTIVA",
  "SUSPENDIDA",
  "CANCELADA",
  "EXPIRADA",
  "FALLIDA",
];

const subscriptionPaymentStateValues = [
  "PENDIENTE",
  "COMPLETADO",
  "FALLIDO",
  "REEMBOLSADO",
  "REVERSADO",
];
const sponsorshipPlanModalities = ["PAYPAL", "MANUAL"];

export const sponsorshipPlanIdValidation = Joi.object({
  id: idSchema("El id del plan").required(),
}).unknown(false);

export const sponsorshipPlanListValidation = Joi.object({
  ...paginationSchema,
  activo: planStateSchema,
  search: searchSchema,
}).unknown(false);

export const sponsorshipPlanCreateValidation = Joi.object({
  nombre: requiredTextSchema("El nombre", 255).required(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  modalidad: Joi.string().trim().uppercase().valid(...sponsorshipPlanModalities).optional(),
  monto: positiveNumberSchema("El monto").required(),
  activo: strictBooleanSchema.optional(),
  orden: Joi.number().integer().min(0).optional(),
}).unknown(false);

export const sponsorshipPlanUpdateValidation = Joi.object({
  nombre: requiredTextSchema("El nombre", 255).optional(),
  descripcion: optionalTextSchema("La descripcion", 5000).optional(),
  modalidad: Joi.string().trim().uppercase().valid(...sponsorshipPlanModalities).optional(),
  monto: positiveNumberSchema("El monto").optional(),
  activo: strictBooleanSchema.optional(),
  orden: Joi.number().integer().min(0).optional(),
})
  .min(1)
  .unknown(false);

export const sponsorshipPlanProvisionValidation = Joi.object({
  id: idSchema("El id del plan").required(),
}).unknown(false);

export const sponsorshipAnimalIdValidation = Joi.object({
  id: idSchema("El id del animal").required(),
}).unknown(false);

export const sponsorshipAnimalListValidation = Joi.object({
  ...paginationSchema,
  search: searchSchema,
  apadrinable: Joi.boolean().optional(),
}).unknown(false);

export const sponsorshipAnimalUpdateValidation = Joi.object({
  apadrinable: strictBooleanSchema.required(),
}).unknown(false);

export const sponsorIdValidation = Joi.object({
  id: idSchema("El id del padrino").required(),
}).unknown(false);

export const sponsorListValidation = Joi.object({
  ...paginationSchema,
  search: searchSchema,
  activo: Joi.boolean().optional(),
  has_active_sponsorship: Joi.boolean().optional(),
}).unknown(false);

export const sponsorCreateValidation = Joi.object({
  nombre: requiredTextSchema("El nombre", 255).required(),
  apellido: requiredTextSchema("El apellido", 255).required(),
  email: emailSchema.required().messages({
    "any.required": "El email es obligatorio.",
  }),
  telefono: optionalTextSchema("El telefono", 50).optional(),
  consentimiento_datos: Joi.boolean().strict().valid(true).required().messages({
    "any.only": "Debes aceptar expresamente el consentimiento de datos.",
    "any.required": "Debes aceptar expresamente el consentimiento de datos.",
  }),
  activo: Joi.boolean().optional(),
}).unknown(false);

export const sponsorUpdateValidation = Joi.object({
  nombre: requiredTextSchema("El nombre", 255).optional(),
  apellido: requiredTextSchema("El apellido", 255).optional(),
  email: emailSchema.optional(),
  telefono: optionalTextSchema("El telefono", 50).optional(),
  activo: Joi.boolean().optional(),
})
  .min(1)
  .unknown(false);

export const sponsorshipIdValidation = Joi.object({
  id: idSchema("El id del apadrinamiento").required(),
}).unknown(false);

export const sponsorshipPublicReferenceValidation = Joi.object({
  publicReference: uuidSchema.messages({
    "string.guid": "La referencia publica del apadrinamiento no es valida.",
  }),
}).unknown(false);

export const sponsorshipListValidation = Joi.object({
  ...paginationSchema,
  search: searchSchema,
  estado: Joi.string().trim().uppercase().valid(...sponsorshipStateValues).optional(),
  sponsor_id: idSchema("El id del padrino").optional(),
  animal_id: idSchema("El id del animal").optional(),
  plan_id: idSchema("El id del plan").optional(),
}).unknown(false);

export const sponsorshipManualCreateValidation = Joi.object({
  sponsor_id: idSchema("El id del padrino").required(),
  animal_id: idSchema("El id del animal").required(),
  plan_id: idSchema("El id del plan").required(),
  fecha_inicio: Joi.date().iso().required().messages({
    "date.base": "La fecha de inicio no es valida.",
    "date.format": "La fecha de inicio debe estar en formato ISO.",
  }),
  proximo_cobro: Joi.date().iso().required().messages({
    "date.base": "La fecha del proximo cobro no es valida.",
    "date.format": "La fecha del proximo cobro debe estar en formato ISO.",
  }),
  metodo_esperado: Joi.string()
    .trim()
    .uppercase()
    .valid("TRANSFERENCIA", "EFECTIVO", "DEPOSITO", "OTRO")
    .required(),
  observacion: optionalTextSchema("La observacion", 1000).optional(),
}).unknown(false);

export const subscriptionIdValidation = Joi.object({
  id: idSchema("El id de la suscripcion").required(),
}).unknown(false);

export const subscriptionListValidation = Joi.object({
  ...paginationSchema,
  search: searchSchema,
  estado: Joi.string().trim().uppercase().valid(...subscriptionStateValues).optional(),
  sponsorship_id: idSchema("El id del apadrinamiento").optional(),
  proveedor_pago_id: idSchema("El id del proveedor").optional(),
}).unknown(false);

export const subscriptionPaymentIdValidation = Joi.object({
  id: idSchema("El id del pago recurrente").required(),
}).unknown(false);

export const subscriptionPaymentListValidation = Joi.object({
  ...paginationSchema,
  search: searchSchema,
  estado: Joi.string().trim().uppercase().valid(...subscriptionPaymentStateValues).optional(),
  subscription_id: idSchema("El id de la suscripcion").optional(),
  sponsor_id: idSchema("El id del padrino").optional(),
  animal_id: idSchema("El id del animal").optional(),
  plan_id: idSchema("El id del plan").optional(),
  con_transaccion: Joi.boolean().optional(),
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
}).unknown(false);

export const subscriptionPaymentManualCreateValidation = Joi.object({
  subscription_id: idSchema("El id de la suscripcion").required(),
  fecha_pago: Joi.date().iso().required().messages({
    "date.base": "La fecha del pago no es valida.",
    "date.format": "La fecha del pago debe estar en formato ISO.",
  }),
  monto: positiveNumberSchema("El monto").required(),
  moneda: Joi.string().trim().uppercase().length(3).required().messages({
    "string.length": "La moneda debe tener 3 caracteres.",
  }),
  metodo: Joi.string()
    .trim()
    .uppercase()
    .valid("TRANSFERENCIA", "EFECTIVO", "DEPOSITO", "OTRO")
    .required(),
  referencia: optionalTextSchema("La referencia", 255).optional(),
  observacion: optionalTextSchema("La observacion", 1000).optional(),
  proximo_cobro: Joi.date().iso().required().messages({
    "date.base": "La fecha del proximo cobro no es valida.",
    "date.format": "La fecha del proximo cobro debe estar en formato ISO.",
  }),
}).unknown(false);

export const subscriptionSyncValidation = Joi.object({
  id: idSchema("El id de la suscripcion").required(),
}).unknown(false);

export const subscriptionCancelBodyValidation = Joi.object({
  motivo: requiredTextSchema("El motivo", 255).required(),
}).unknown(false);

export const publicSponsorshipAnimalListValidation = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
  search: searchSchema,
}).unknown(false);

export const publicSponsorshipAnimalIdValidation = Joi.object({
  id: idSchema("El id del animal").required(),
}).unknown(false);

export const publicSponsorshipStartValidation = Joi.object({
  animal_id: idSchema("El id del animal").required(),
  plan_id: idSchema("El id del plan").required(),
  nombre: requiredTextSchema("El nombre", 255).required(),
  apellido: requiredTextSchema("El apellido", 255).required(),
  email: emailSchema.required().messages({
    "any.required": "El email es obligatorio.",
  }),
  telefono: optionalTextSchema("El telefono", 50).optional(),
  consentimiento_datos: Joi.boolean().strict().valid(true).required().messages({
    "any.only": "Debes aceptar expresamente el consentimiento de datos.",
    "any.required": "Debes aceptar expresamente el consentimiento de datos.",
  }),
}).unknown(false);

export const publicSponsorshipIdempotencyKeyValidation = Joi.object({
  idempotencyKey: uuidSchema.messages({
    "string.guid": "Idempotency-Key debe ser un UUID valido.",
  }),
}).unknown(false);

export const adminSponsorshipIdempotencyKeyValidation = Joi.object({
  idempotencyKey: uuidSchema.messages({
    "string.guid": "Idempotency-Key debe ser un UUID valido.",
  }),
}).unknown(false);

export const publicFileAssetIdValidation = Joi.object({
  publicId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "El identificador publico del archivo no es valido.",
    }),
}).unknown(false);

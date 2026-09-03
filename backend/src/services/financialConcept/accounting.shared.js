"use strict";

import { ILike } from "typeorm";
import { AppDataSource } from "../../config/configDb.js";
import Donor from "../../entities/donor.entity.js";
import Transaction from "../../entities/financialConcept/transaction.entity.js";
import TransactionCategory from "../../entities/financialConcept/transaction_category.entity.js";
import PaymentProvider from "../../entities/financialConcept/payment_provider.entity.js";
import PayableAccount from "../../entities/financialConcept/payable_account.entity.js";
import PayablePayment from "../../entities/financialConcept/payable_payment.entity.js";
import PaymentOrder from "../../entities/financialConcept/payment_order.entity.js";
import WebhookLog from "../../entities/financialConcept/webhook_log.entity.js";
import User from "../../entities/user.entity.js";

const LEGACY_TRANSACTION_STATE_MAP = {
  COMPLETADA: "CONFIRMADA",
  CANCELADA: "ANULADA",
  FALLIDA: "ANULADA",
};

const WEBHOOK_REDACTION_PLACEHOLDER = "[REDACTED]";
const SENSITIVE_WEBHOOK_KEY_FRAGMENTS = [
  "authorization",
  "cookie",
  "set-cookie",
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-sig",
  "paypal-transmission-id",
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "client_secret",
  "password",
  "signature",
  "api_key",
  "apikey",
  "private_key",
  "bearer",
];

export {
  AppDataSource,
  Donor,
  Transaction,
  TransactionCategory,
  PaymentProvider,
  PayableAccount,
  PayablePayment,
  PaymentOrder,
  WebhookLog,
  User,
};

export function toNumericNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

export function normalizeNullableString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeCode(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeCurrency(value) {
  return normalizeCode(value) || "CLP";
}

export function toNullableNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function toDateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function toIsoTimestamp(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function toDateStart(value) {
  if (!value) return null;
  return new Date(`${toDateOnly(value)}T00:00:00.000Z`);
}

export function toDateEnd(value) {
  if (!value) return null;
  return new Date(`${toDateOnly(value)}T23:59:59.999Z`);
}

export function normalizeTransactionState(state) {
  return LEGACY_TRANSACTION_STATE_MAP[state] || state || "CONFIRMADA";
}

export function transactionStateDbValuesForFilter(state) {
  switch (state) {
    case "CONFIRMADA":
      return ["CONFIRMADA", "COMPLETADA"];
    case "ANULADA":
      return ["ANULADA", "CANCELADA", "FALLIDA"];
    default:
      return [state];
  }
}

export function buildPagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 100);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function buildPagedResult(items, total, page, limit) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export function calculateNetAmount(montoBruto, montoFee = 0) {
  const gross = toNumericNumber(montoBruto, NaN);
  const fee = toNumericNumber(montoFee, NaN);

  if (!Number.isFinite(gross) || gross < 0) {
    throw new Error("El monto bruto no puede ser negativo.");
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("El monto fee no puede ser negativo.");
  }
  if (fee > gross) {
    throw new Error("El monto fee no puede ser mayor al monto bruto.");
  }

  return Number((gross - fee).toFixed(2));
}

export function calculatePayableAmounts(montoTotal, montoPagado = 0) {
  const total = toNumericNumber(montoTotal, NaN);
  const paid = toNumericNumber(montoPagado, NaN);

  if (!Number.isFinite(total) || total < 0) {
    throw new Error("El monto total no puede ser negativo.");
  }
  if (!Number.isFinite(paid) || paid < 0) {
    throw new Error("El monto pagado no puede ser negativo.");
  }
  if (paid > total) {
    throw new Error("El monto pagado no puede ser mayor al monto total.");
  }

  const balance = Number((total - paid).toFixed(2));
  return {
    monto_total: Number(total.toFixed(2)),
    monto_pagado: Number(paid.toFixed(2)),
    saldo_pendiente: balance,
  };
}

export function derivePayableState({
  estadoActual = null,
  montoTotal,
  montoPagado = 0,
  fechaVencimiento = null,
}) {
  if (estadoActual === "ANULADA" || estadoActual === "CONDONADA") {
    return estadoActual;
  }

  const { saldo_pendiente } = calculatePayableAmounts(montoTotal, montoPagado);

  if (saldo_pendiente === 0) return "PAGADA";
  if (Number(montoPagado) > 0 && saldo_pendiente > 0) return "PAGADA_PARCIAL";

  if (fechaVencimiento) {
    const today = new Date().toISOString().slice(0, 10);
    if (String(fechaVencimiento) < today) return "VENCIDA";
  }

  return "PENDIENTE";
}

export async function getUserOrThrow(manager, userId, { optional = false } = {}) {
  if (!userId && optional) return null;
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Usuario invalido");
  }

  const repository = manager.getRepository(User);
  const user = await repository.findOne({ where: { id_usuario: id } });
  if (!user) throw new Error("Usuario no encontrado");
  return user;
}

export async function getTransactionCategoryOrThrow(manager, categoryId, { optional = false } = {}) {
  if (!categoryId && optional) return null;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Categoria de transaccion invalida");
  }

  const repository = manager.getRepository(TransactionCategory);
  const category = await repository.findOne({
    where: { categoria_transaccion_id: id },
    relations: { categoria_padre: true },
  });
  if (!category) throw new Error("Categoria de transaccion no encontrada");
  return category;
}

export async function getTransactionCategoryByKeyOrThrow(
  manager,
  categoryKey,
  { optional = false, onlyActive = false } = {},
) {
  const clave = normalizeCode(categoryKey);
  if (!clave && optional) return null;
  if (!clave) {
    throw new Error("Clave de categoria de transaccion invalida");
  }

  const repository = manager.getRepository(TransactionCategory);
  const where = onlyActive ? { clave, activo: true } : { clave };
  const category = await repository.findOne({
    where,
    relations: { categoria_padre: true },
  });
  if (!category) throw new Error("Categoria de transaccion no encontrada");
  return category;
}

export async function getPaymentProviderOrThrow(manager, providerId, { optional = false } = {}) {
  if (!providerId && optional) return null;
  const id = Number(providerId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Proveedor de pago invalido");
  }

  const repository = manager.getRepository(PaymentProvider);
  const provider = await repository.findOne({
    where: { proveedor_pago_id: id },
  });
  if (!provider) throw new Error("Proveedor de pago no encontrado");
  return provider;
}

export async function getPaymentProviderByKeyOrThrow(
  manager,
  providerKey,
  { optional = false, onlyActive = false } = {},
) {
  const clave = normalizeCode(providerKey);
  if (!clave && optional) return null;
  if (!clave) {
    throw new Error("Clave de proveedor de pago invalida");
  }

  const repository = manager.getRepository(PaymentProvider);
  const where = onlyActive ? { clave, activo: true } : { clave };
  const provider = await repository.findOne({ where });
  if (!provider) throw new Error("Proveedor de pago no encontrado");
  return provider;
}

export async function getDonorOrThrow(manager, donorId, { optional = false } = {}) {
  if (!donorId && optional) return null;
  const id = Number(donorId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Donante invalido");
  }

  const repository = manager.getRepository(Donor);
  const donor = await repository.findOne({
    where: { donante_id: id },
  });
  if (!donor) throw new Error("Donante no encontrado");
  return donor;
}

export async function getPaymentOrderOrThrow(manager, orderId, { optional = false } = {}) {
  if (!orderId && optional) return null;
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Orden de pago invalida");
  }

  const repository = manager.getRepository(PaymentOrder);
  const order = await repository.findOne({
    where: { orden_pago_id: id },
  });
  if (!order) throw new Error("Orden de pago no encontrada");
  return order;
}

export async function getPayableAccountOrThrow(manager, payableId, { optional = false } = {}) {
  if (!payableId && optional) return null;
  const id = Number(payableId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Cuenta por pagar invalida");
  }

  const repository = manager.getRepository(PayableAccount);
  const payable = await repository.findOne({
    where: { cuenta_por_pagar_id: id },
    relations: {
      category: true,
      created_by: true,
      payments: {
        transaction: true,
        created_by: true,
      },
    },
  });
  if (!payable) throw new Error("Cuenta por pagar no encontrada");
  return payable;
}

export async function getTransactionOrThrow(manager, transactionId, { optional = false } = {}) {
  if (!transactionId && optional) return null;
  const id = Number(transactionId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Transaccion invalida");
  }

  const repository = manager.getRepository(Transaction);
  const transaction = await repository.findOne({
    where: { transaccion_id: id },
    relations: {
      category: true,
      payment_provider: true,
      payment_order: true,
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
    },
  });
  if (!transaction) throw new Error("Transaccion no encontrada");
  return transaction;
}

export function mapUserSummary(user) {
  if (!user) return null;

  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre || "",
    apellido: user.apellido || "",
    email: user.email || "",
  };
}

export function mapDonorSummary(donor) {
  if (!donor) return null;

  return {
    donante_id: donor.donante_id,
    nombre: donor.nombre || "",
    apellido: donor.apellido || null,
    telefono: donor.telefono || "",
    email: donor.email || "",
    usuario_instagram: donor.usuario_instagram || null,
  };
}

export function mapTransactionCategory(category) {
  if (!category) return null;

  return {
    categoria_transaccion_id: category.categoria_transaccion_id,
    clave: category.clave || "",
    nombre: category.nombre || "",
    tipo: category.tipo || "",
    descripcion: category.descripcion || null,
    activo: Boolean(category.activo),
    es_sistema: Boolean(category.es_sistema),
    categoria_padre_id: category.categoria_padre?.categoria_transaccion_id || null,
    categoria_padre: category.categoria_padre
      ? {
          categoria_transaccion_id: category.categoria_padre.categoria_transaccion_id,
          clave: category.categoria_padre.clave || "",
          nombre: category.categoria_padre.nombre || "",
        }
      : null,
    createdAt: toIsoTimestamp(category.createdAt),
    updatedAt: toIsoTimestamp(category.updatedAt),
  };
}

export function mapPaymentProvider(provider) {
  if (!provider) return null;

  return {
    proveedor_pago_id: provider.proveedor_pago_id,
    clave: provider.clave || "",
    nombre: provider.nombre || "",
    tipo: provider.tipo || "",
    activo: Boolean(provider.activo),
    metadata_publica: provider.metadata_publica || null,
    createdAt: toIsoTimestamp(provider.createdAt),
    updatedAt: toIsoTimestamp(provider.updatedAt),
  };
}

export function mapPaymentOrder(order) {
  if (!order) return null;

  return {
    orden_pago_id: order.orden_pago_id,
    proveedor_orden_id: order.proveedor_orden_id || null,
    proposito: order.proposito || "",
    moneda: order.moneda || "CLP",
    monto_bruto: toNumericNumber(order.monto_bruto),
    estado: order.estado || "",
    approval_url: order.approval_url || null,
    fecha_expiracion: toIsoTimestamp(order.fecha_expiracion),
    capturada_en: toIsoTimestamp(order.capturada_en),
    metadata: order.metadata || null,
    payment_provider: mapPaymentProvider(order.payment_provider),
    donor: mapDonorSummary(order.donor),
    createdAt: toIsoTimestamp(order.createdAt),
    updatedAt: toIsoTimestamp(order.updatedAt),
  };
}

export function mapTransaction(transaction) {
  if (!transaction) return null;

  const payableState = transaction.payable_account
    ? derivePayableState({
        estadoActual: transaction.payable_account.estado,
        montoTotal: transaction.payable_account.monto_total,
        montoPagado: transaction.payable_account.monto_pagado,
        fechaVencimiento: transaction.payable_account.fecha_vencimiento,
      })
    : null;

  return {
    transaccion_id: transaction.transaccion_id,
    tipo: transaction.tipo || "",
    descripcion: transaction.descripcion || null,
    moneda: transaction.moneda || "CLP",
    monto_bruto: toNumericNumber(transaction.monto_bruto),
    monto_fee: toNumericNumber(transaction.monto_fee),
    monto_neto: toNumericNumber(transaction.monto_neto),
    fecha_transaccion: toIsoTimestamp(transaction.fecha_transaccion),
    estado: normalizeTransactionState(transaction.estado),
    origen_tipo: transaction.origen_tipo || null,
    origen_id: transaction.origen_id ?? null,
    referencia_externa: transaction.referencia_externa || null,
    idempotencia_key: transaction.idempotencia_key || null,
    metadata: transaction.metadata || null,
    category: mapTransactionCategory(transaction.category),
    payment_provider: mapPaymentProvider(transaction.payment_provider),
    payment_order: transaction.payment_order
      ? {
          orden_pago_id: transaction.payment_order.orden_pago_id,
          proposito: transaction.payment_order.proposito || "",
          estado: transaction.payment_order.estado || "",
        }
      : null,
    donor: mapDonorSummary(transaction.donor),
    payable_account: transaction.payable_account
      ? {
          cuenta_por_pagar_id: transaction.payable_account.cuenta_por_pagar_id,
          estado: payableState || "",
          saldo_pendiente: toNumericNumber(transaction.payable_account.saldo_pendiente),
        }
      : null,
    created_by: mapUserSummary(transaction.created_by),
    createdAt: toIsoTimestamp(transaction.createdAt),
    updatedAt: toIsoTimestamp(transaction.updatedAt),
  };
}
export function mapPayablePayment(payment) {
  if (!payment) return null;

  return {
    pago_cuenta_por_pagar_id: payment.pago_cuenta_por_pagar_id,
    monto_aplicado: toNumericNumber(payment.monto_aplicado),
    fecha_pago: toDateOnly(payment.fecha_pago),
    payable_account: payment.payableAccount
      ? {
          cuenta_por_pagar_id: payment.payableAccount.cuenta_por_pagar_id,
          estado: payment.payableAccount.estado || null,
          saldo_pendiente: toNumericNumber(payment.payableAccount.saldo_pendiente),
        }
      : null,
    transaction: mapTransaction(payment.transaction),
    created_by: mapUserSummary(payment.created_by),
    createdAt: toIsoTimestamp(payment.createdAt),
  };
}

export function mapPayableAccount(payable) {
  if (!payable) return null;

  const derivedState = derivePayableState({
    estadoActual: payable.estado,
    montoTotal: payable.monto_total,
    montoPagado: payable.monto_pagado,
    fechaVencimiento: payable.fecha_vencimiento,
  });

  return {
    cuenta_por_pagar_id: payable.cuenta_por_pagar_id,
    origen_tipo: payable.origen_tipo || null,
    origen_id: payable.origen_id ?? null,
    proveedor_tipo: payable.proveedor_tipo || null,
    proveedor_id: payable.proveedor_id ?? null,
    descripcion: payable.descripcion || null,
    moneda: payable.moneda || "CLP",
    monto_total: toNumericNumber(payable.monto_total),
    monto_pagado: toNumericNumber(payable.monto_pagado),
    saldo_pendiente: toNumericNumber(payable.saldo_pendiente),
    fecha_emision: toDateOnly(payable.fecha_emision),
    fecha_vencimiento: toDateOnly(payable.fecha_vencimiento),
    estado: derivedState || "",
    metadata: payable.metadata || null,
    category: mapTransactionCategory(payable.category),
    created_by: mapUserSummary(payable.created_by),
    payments: Array.isArray(payable.payments)
      ? payable.payments.map(mapPayablePayment)
      : [],
    createdAt: toIsoTimestamp(payable.createdAt),
    updatedAt: toIsoTimestamp(payable.updatedAt),
  };
}

export function mapWebhookLog(log) {
  if (!log) return null;

  return {
    webhook_log_id: log.webhook_log_id,
    evento_tipo: log.evento_tipo || "",
    proveedor_evento_id: log.proveedor_evento_id || "",
    payload_sanitizado: sanitizeWebhookObject(log.payload || null),
    headers_sanitizados: sanitizeWebhookObject(log.headers || null),
    firma_verificada: Boolean(log.firma_verificada),
    estado: log.estado || "",
    recibido_en: toIsoTimestamp(log.recibido_en),
    procesado_en: toIsoTimestamp(log.procesado_en),
    intentos: Number(log.intentos || 0),
    error_mensaje: log.error_mensaje || null,
    referencia_tipo: log.referencia_tipo || null,
    referencia_id: log.referencia_id ?? null,
    payment_provider: mapPaymentProvider(log.payment_provider),
    createdAt: toIsoTimestamp(log.createdAt),
  };
}

export function buildSearchWhere(search) {
  if (!search) return null;
  return ILike(`%${String(search).trim()}%`);
}

export function isTransactionConfirmed(state) {
  return ["CONFIRMADA", "COMPLETADA"].includes(state);
}

export function isUniqueConstraintError(error) {
  return error?.code === "23505" || error?.driverError?.code === "23505";
}

function normalizeWebhookSensitiveKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase();
}

function isSensitiveWebhookKey(key) {
  const normalizedKey = normalizeWebhookSensitiveKey(key);
  return SENSITIVE_WEBHOOK_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));
}

function sanitizeWebhookString(value) {
  if (typeof value !== "string") return value;

  const trimmedValue = value.trim();
  if (!trimmedValue) return value;

  if (/^bearer\s+/i.test(trimmedValue)) {
    return WEBHOOK_REDACTION_PLACEHOLDER;
  }

  return value;
}

export function sanitizeWebhookObject(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeWebhookObject);
  }

  if (!value || typeof value !== "object") {
    return sanitizeWebhookString(value);
  }

  return Object.entries(value).reduce((sanitized, [key, nestedValue]) => {
    sanitized[key] = isSensitiveWebhookKey(key)
      ? WEBHOOK_REDACTION_PLACEHOLDER
      : sanitizeWebhookObject(nestedValue);
    return sanitized;
  }, {});
}

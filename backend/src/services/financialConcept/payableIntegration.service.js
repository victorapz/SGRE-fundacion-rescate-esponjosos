"use strict";

import {
  PayableAccount,
  PayablePayment,
  Transaction,
  calculateNetAmount,
  calculatePayableAmounts,
  derivePayableState,
  getPaymentProviderOrThrow,
  getTransactionCategoryOrThrow,
  getUserOrThrow,
  normalizeCurrency,
  normalizeNullableString,
  toNumericNumber,
} from "./accounting.shared.js";

const DEFAULT_MANUAL_PROVIDER_KEY = "MANUAL";
const DISABLED_PAYABLE_STATE = "ANULADA";
const PAYABLE_MOVEMENTS_DELETE_MESSAGE =
  "No se puede eliminar este registro porque tiene movimientos contables asociados.";

export function hasRegisteredPayablePayments(payable) {
  return toNumericNumber(payable?.monto_pagado, 0) > 0
    || (Array.isArray(payable?.payments) && payable.payments.length > 0);
}

function hasRegisteredPayableTransactions(payable) {
  return Array.isArray(payable?.transactions) && payable.transactions.length > 0;
}

function hasRegisteredPayableMovements(payable) {
  return hasRegisteredPayablePayments(payable) || hasRegisteredPayableTransactions(payable);
}

export function shouldReactivateDisabledPayable(payable, reactivateDisabled = false) {
  return Boolean(
    reactivateDisabled
    && payable?.estado === DISABLED_PAYABLE_STATE
    && !hasRegisteredPayableMovements(payable),
  );
}

function buildPayableMetadata(baseMetadata, extraMetadata = {}) {
  return {
    ...(baseMetadata || {}),
    ...(extraMetadata || {}),
  };
}

async function getPayableWithRelations(repository, payableId) {
  return repository.findOne({
    where: { cuenta_por_pagar_id: Number(payableId) },
    relations: {
      category: true,
      created_by: true,
      transactions: {
        category: true,
        payment_provider: true,
        donor: true,
        created_by: true,
      },
      payments: {
        transaction: {
          category: true,
          payment_provider: true,
          donor: true,
          payable_account: true,
          created_by: true,
        },
        created_by: true,
      },
    },
  });
}

async function getPayableByOrigin(manager, originType, originId) {
  return manager.getRepository(PayableAccount).findOne({
    where: {
      origen_tipo: originType,
      origen_id: Number(originId),
    },
    relations: {
      category: true,
      created_by: true,
      transactions: {
        category: true,
        payment_provider: true,
        donor: true,
        created_by: true,
      },
      payments: {
        transaction: {
          category: true,
          payment_provider: true,
          donor: true,
          payable_account: true,
          created_by: true,
        },
        created_by: true,
      },
    },
  });
}

export async function findPayableBySource(manager, { originType, originId }) {
  const normalizedOriginType = normalizeNullableString(originType)?.toUpperCase();

  if (!normalizedOriginType || !Number.isInteger(Number(originId)) || Number(originId) <= 0) {
    throw new Error("El origen de la cuenta por pagar es invalido.");
  }

  return getPayableByOrigin(manager, normalizedOriginType, originId);
}

export async function assertSourceCanBeDeletedFinancially(manager, {
  originType,
  originId,
  sourceLabel = "registro",
}) {
  const payable = await findPayableBySource(manager, { originType, originId });

  if (!payable) {
    return null;
  }

  if (hasRegisteredPayableMovements(payable)) {
    throw new Error(PAYABLE_MOVEMENTS_DELETE_MESSAGE);
  }

  throw new Error(
    `No se puede eliminar este registro porque tiene una cuenta por pagar asociada. `
    + `Desactive la generacion de cuenta por pagar antes de eliminar ${sourceLabel}.`,
  );
}

export async function cancelPayableForSourceIfNoPayments(manager, {
  originType,
  originId,
  sourceLabel = "registro",
  reason = "Origen cancelado o desactivado desde su modulo.",
  metadata = null,
}) {
  const payableRepository = manager.getRepository(PayableAccount);
  const payable = await findPayableBySource(manager, { originType, originId });

  if (!payable) {
    return null;
  }

  if (hasRegisteredPayableMovements(payable)) {
    throw new Error(PAYABLE_MOVEMENTS_DELETE_MESSAGE);
  }

  const nextMetadata = buildPayableMetadata(payable.metadata, {
    source_cancelled: true,
    source_type: normalizeNullableString(originType)?.toUpperCase() || null,
    source_id: Number(originId),
    source_label: normalizeNullableString(sourceLabel) || "registro",
    cancelled_at: new Date().toISOString(),
    reason: normalizeNullableString(reason) || "Origen cancelado o desactivado.",
    ...(metadata || {}),
  });

  await payableRepository.update(
    { cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id) },
    {
      estado: DISABLED_PAYABLE_STATE,
      metadata: nextMetadata,
    },
  );

  return getPayableWithRelations(payableRepository, payable.cuenta_por_pagar_id);
}

export async function findTransactionCategoryByKey(manager, key, { optional = false } = {}) {
  const normalizedKey = normalizeNullableString(key)?.toUpperCase();
  if (!normalizedKey && optional) return null;
  if (!normalizedKey) {
    throw new Error("La clave de categoria contable es obligatoria.");
  }

  const repository = manager.getRepository("TransactionCategory");
  const category = await repository.findOne({
    where: { clave: normalizedKey },
    relations: {
      categoria_padre: true,
    },
  });

  if (!category && !optional) {
    throw new Error(`No se encontro la categoria contable ${normalizedKey}.`);
  }

  return category;
}

export async function findTransactionCategoryByKeys(manager, keys = []) {
  for (const key of keys) {
    const category = await findTransactionCategoryByKey(manager, key, { optional: true });
    if (category) return category;
  }

  throw new Error(
    `No se encontro una categoria contable para las claves: ${keys.join(", ")}.`,
  );
}

export async function findPaymentProviderByKey(manager, key, { optional = false } = {}) {
  const normalizedKey = normalizeNullableString(key)?.toUpperCase();
  if (!normalizedKey && optional) return null;
  if (!normalizedKey) {
    throw new Error("La clave del proveedor de pago es obligatoria.");
  }

  const repository = manager.getRepository("PaymentProvider");
  const provider = await repository.findOne({
    where: { clave: normalizedKey },
  });

  if (!provider && !optional) {
    throw new Error(`No se encontro el proveedor de pago ${normalizedKey}.`);
  }

  return provider;
}

export function mapPayableIntegrationSummary(result = {}) {
  const payable = result.payable || null;

  return {
    cuenta_por_pagar_id: payable?.cuenta_por_pagar_id || null,
    estado: payable?.estado || null,
    saldo_pendiente: payable ? toNumericNumber(payable.saldo_pendiente) : null,
    pago_cuenta_por_pagar_id: result.payment?.pago_cuenta_por_pagar_id || null,
    transaccion_id: result.transaction?.transaccion_id || null,
    mensaje: result.message || null,
  };
}

async function createAutomaticTransactionForPayable(manager, {
  payable,
  amountApplied,
  fechaPago,
  descripcion,
  categoriaTransaccionId,
  proveedorPagoId,
  createdById,
  metadata,
}) {
  const transactionRepository = manager.getRepository(Transaction);
  const createdBy = createdById
    ? await getUserOrThrow(manager, createdById)
    : null;
  const paymentProvider = proveedorPagoId
    ? await getPaymentProviderOrThrow(manager, proveedorPagoId)
    : null;

  const grossAmount = Number(amountApplied.toFixed(2));
  const netAmount = calculateNetAmount(grossAmount, 0);

  const newTransaction = transactionRepository.create({
    tipo: "EGRESO",
    category: categoriaTransaccionId
      ? { categoria_transaccion_id: Number(categoriaTransaccionId) }
      : null,
    payment_provider: paymentProvider
      ? { proveedor_pago_id: Number(paymentProvider.proveedor_pago_id) }
      : null,
    payable_account: { cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id) },
    descripcion: normalizeNullableString(descripcion)
      || `Pago cuenta por pagar #${payable.cuenta_por_pagar_id}`,
    moneda: normalizeCurrency(payable.moneda),
    monto_bruto: grossAmount,
    monto_fee: 0,
    monto_neto: netAmount,
    fecha_transaccion: fechaPago,
    estado: "CONFIRMADA",
    created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
    metadata: metadata || null,
  });

  return transactionRepository.save(newTransaction);
}

async function attachPayableToExistingTransaction(manager, transaction, payable) {
  if (transaction.payable_account) {
    if (
      Number(transaction.payable_account.cuenta_por_pagar_id)
      !== Number(payable.cuenta_por_pagar_id)
    ) {
      throw new Error("La transaccion indicada ya se encuentra asociada a otra cuenta por pagar.");
    }

    return transaction;
  }

  transaction.payable_account = { cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id) };
  await manager.getRepository(Transaction).save(transaction);
  return transaction;
}

async function resolveLinkedTransactionForAutomaticPayment(manager, {
  payable,
  existingTransactionId = null,
  amountApplied,
  fechaPago,
  descripcion,
  categoriaTransaccionId,
  proveedorPagoId,
  createdById,
  metadata,
}) {
  if (!existingTransactionId) {
    return createAutomaticTransactionForPayable(manager, {
      payable,
      amountApplied,
      fechaPago,
      descripcion,
      categoriaTransaccionId,
      proveedorPagoId,
      createdById,
      metadata,
    });
  }

  const transactionRepository = manager.getRepository(Transaction);
  const transaction = await transactionRepository.findOne({
    where: { transaccion_id: Number(existingTransactionId) },
    relations: {
      payable_account: true,
      payable_payments: true,
    },
  });

  if (!transaction) {
    throw new Error("La transaccion indicada para el pago automatico no existe.");
  }

  if (transaction.tipo !== "EGRESO") {
    throw new Error("La transaccion indicada para el pago automatico debe ser de tipo EGRESO.");
  }

  if (!["CONFIRMADA", "COMPLETADA"].includes(transaction.estado)) {
    throw new Error(
      "La transaccion indicada para el pago automatico debe estar confirmada o completada.",
    );
  }

  if (Array.isArray(transaction.payable_payments) && transaction.payable_payments.length > 0) {
    throw new Error("La transaccion indicada para el pago automatico ya fue usada en otro pago.");
  }

  if (normalizeCurrency(transaction.moneda) !== normalizeCurrency(payable.moneda)) {
    throw new Error(
      "La transaccion indicada para el pago automatico debe usar la misma moneda de la cuenta por pagar.",
    );
  }

  if (toNumericNumber(transaction.monto_neto, 0) !== Number(amountApplied.toFixed(2))) {
    throw new Error(
      "La transaccion indicada para el pago automatico debe tener monto neto igual al saldo a pagar.",
    );
  }

  return attachPayableToExistingTransaction(manager, transaction, payable);
}

async function registerAutomaticFullPayment(manager, payable, autoPaymentConfig = {}, authContext = {}) {
  const payableRepository = manager.getRepository(PayableAccount);
  const paymentRepository = manager.getRepository(PayablePayment);
  const amountApplied = Number(toNumericNumber(payable.saldo_pendiente, 0).toFixed(2));

  if (amountApplied <= 0) {
    return {
      payable,
      payment: null,
      transaction: null,
      message: autoPaymentConfig.messageWhenNoPayment || "La cuenta por pagar ya estaba saldada.",
    };
  }

  const category = autoPaymentConfig.categoryKeys?.length > 0
    ? await findTransactionCategoryByKeys(manager, autoPaymentConfig.categoryKeys)
    : payable.category
      || null;
  const provider = autoPaymentConfig.providerKey
    ? await findPaymentProviderByKey(manager, autoPaymentConfig.providerKey)
    : await findPaymentProviderByKey(manager, DEFAULT_MANUAL_PROVIDER_KEY);
  const linkedTransaction = await resolveLinkedTransactionForAutomaticPayment(manager, {
    payable,
    existingTransactionId: autoPaymentConfig.existingTransactionId || null,
    amountApplied,
    fechaPago: autoPaymentConfig.fechaPago,
    descripcion: autoPaymentConfig.descripcion,
    categoriaTransaccionId: category?.categoria_transaccion_id || payable.category?.categoria_transaccion_id,
    proveedorPagoId: provider?.proveedor_pago_id || null,
    createdById: authContext.userId || null,
    metadata: autoPaymentConfig.metadata || null,
  });

  const createdBy = authContext.userId
    ? await getUserOrThrow(manager, authContext.userId)
    : null;

  const payment = paymentRepository.create({
    payableAccount: { cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id) },
    transaction: { transaccion_id: Number(linkedTransaction.transaccion_id) },
    monto_aplicado: amountApplied,
    fecha_pago: autoPaymentConfig.fechaPago,
    created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
  });

  const savedPayment = await paymentRepository.save(payment);
  const nextPaidAmount = Number(
    (toNumericNumber(payable.monto_pagado, 0) + amountApplied).toFixed(2),
  );
  const amounts = calculatePayableAmounts(payable.monto_total, nextPaidAmount);
  const nextEstado = derivePayableState({
    montoTotal: amounts.monto_total,
    montoPagado: amounts.monto_pagado,
    fechaVencimiento: payable.fecha_vencimiento,
  });

  await payableRepository.update(
    { cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id) },
    {
      monto_pagado: amounts.monto_pagado,
      saldo_pendiente: amounts.saldo_pendiente,
      estado: nextEstado,
    },
  );

  const refreshedPayable = await getPayableWithRelations(
    payableRepository,
    payable.cuenta_por_pagar_id,
  );

  return {
    payable: refreshedPayable,
    payment: savedPayment,
    transaction: linkedTransaction,
    message: autoPaymentConfig.successMessage || "Cuenta por pagar pagada automaticamente.",
  };
}

export async function syncPayableFromSource(manager, {
  originType,
  originId,
  providerType = null,
  providerId = null,
  categoryKeys = [],
  description = null,
  moneda = "CLP",
  montoTotal = 0,
  fechaEmision,
  fechaVencimiento = null,
  metadata = null,
  disabled = false,
  disableReason = null,
  reactivateDisabled = false,
  autoPayment = null,
}, authContext = {}) {
  const payableRepository = manager.getRepository(PayableAccount);
  const normalizedOriginType = normalizeNullableString(originType)?.toUpperCase();
  const normalizedDescription = normalizeNullableString(description);
  const normalizedMoneda = normalizeCurrency(moneda);
  const numericMontoTotal = Number(toNumericNumber(montoTotal, 0).toFixed(2));
  const existingPayable = await getPayableByOrigin(manager, normalizedOriginType, originId);
  const hasPayments = hasRegisteredPayablePayments(existingPayable);
  const shouldReactivate = shouldReactivateDisabledPayable(
    existingPayable,
    reactivateDisabled,
  );

  if (!normalizedOriginType || !Number.isInteger(Number(originId)) || Number(originId) <= 0) {
    throw new Error("El origen de la cuenta por pagar es invalido.");
  }

  if (disabled || numericMontoTotal <= 0) {
    if (!existingPayable) {
      return {
        payable: null,
        payment: null,
        transaction: null,
        message: "No se genero cuenta por pagar para este origen.",
      };
    }

    if (hasRegisteredPayableMovements(existingPayable)) {
      return {
        payable: existingPayable,
        payment: null,
        transaction: null,
        message:
          "La cuenta por pagar existente mantiene movimientos registrados y no se anulo automaticamente.",
      };
    }

    const nextMetadata = buildPayableMetadata(existingPayable.metadata, {
      integracion_origen: {
        deshabilitada_en: new Date().toISOString(),
        motivo: normalizeNullableString(disableReason)
          || "El origen ya no requiere cuenta por pagar.",
      },
    });

    await payableRepository.update(
      { cuenta_por_pagar_id: Number(existingPayable.cuenta_por_pagar_id) },
      {
        estado: DISABLED_PAYABLE_STATE,
        metadata: nextMetadata,
      },
    );

    return {
      payable: await getPayableWithRelations(
        payableRepository,
        existingPayable.cuenta_por_pagar_id,
      ),
      payment: null,
      transaction: null,
      message: "Cuenta por pagar anulada por sincronizacion con el origen.",
    };
  }

  const category = await findTransactionCategoryByKeys(manager, categoryKeys);
  const createdBy = authContext.userId
    ? await getUserOrThrow(manager, authContext.userId)
    : null;

  let payable = existingPayable;

  if (!existingPayable) {
    const amounts = calculatePayableAmounts(numericMontoTotal, 0);
    const estado = derivePayableState({
      montoTotal: amounts.monto_total,
      montoPagado: amounts.monto_pagado,
      fechaVencimiento,
    });

    const newPayable = payableRepository.create({
      origen_tipo: normalizedOriginType,
      origen_id: Number(originId),
      proveedor_tipo: normalizeNullableString(providerType),
      proveedor_id: providerId ? Number(providerId) : null,
      category: {
        categoria_transaccion_id: Number(category.categoria_transaccion_id),
      },
      descripcion: normalizedDescription,
      moneda: normalizedMoneda,
      monto_total: amounts.monto_total,
      monto_pagado: amounts.monto_pagado,
      saldo_pendiente: amounts.saldo_pendiente,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || null,
      estado,
      metadata: metadata || null,
      created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
    });

    const savedPayable = await payableRepository.save(newPayable);
    payable = await getPayableWithRelations(payableRepository, savedPayable.cuenta_por_pagar_id);
  } else {
    if (hasPayments && normalizedMoneda !== normalizeCurrency(existingPayable.moneda)) {
      throw new Error("No se puede cambiar la moneda de una cuenta por pagar con pagos registrados.");
    }

    if (numericMontoTotal < toNumericNumber(existingPayable.monto_pagado, 0)) {
      throw new Error("El monto total no puede ser menor que el monto pagado registrado.");
    }

    const amounts = calculatePayableAmounts(numericMontoTotal, existingPayable.monto_pagado);
    const estado = derivePayableState({
      estadoActual: shouldReactivate ? null : existingPayable.estado,
      montoTotal: amounts.monto_total,
      montoPagado: amounts.monto_pagado,
      fechaVencimiento: fechaVencimiento || existingPayable.fecha_vencimiento,
    });
    const nextMetadata = buildPayableMetadata(existingPayable.metadata, {
      ...(metadata || {}),
      ...(shouldReactivate
        ? {
            reactivated_from_source: true,
            reactivated_at: new Date().toISOString(),
          }
        : {}),
    });

    const updatePayload = hasPayments
      ? {
          descripcion: normalizedDescription,
          fecha_vencimiento: fechaVencimiento || null,
          metadata: nextMetadata,
          monto_total: amounts.monto_total,
          saldo_pendiente: amounts.saldo_pendiente,
          estado,
        }
      : {
          proveedor_tipo: normalizeNullableString(providerType),
          proveedor_id: providerId ? Number(providerId) : null,
          descripcion: normalizedDescription,
          moneda: normalizedMoneda,
          monto_total: amounts.monto_total,
          saldo_pendiente: amounts.saldo_pendiente,
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento || null,
          metadata: nextMetadata,
          estado,
        };

    await payableRepository.update(
      { cuenta_por_pagar_id: Number(existingPayable.cuenta_por_pagar_id) },
      updatePayload,
    );

    if (!hasPayments) {
      await payableRepository.save({
        cuenta_por_pagar_id: Number(existingPayable.cuenta_por_pagar_id),
        category: category
          ? {
              categoria_transaccion_id: Number(category.categoria_transaccion_id),
            }
          : null,
      });
    }

    payable = await getPayableWithRelations(
      payableRepository,
      existingPayable.cuenta_por_pagar_id,
    );
  }

  if (autoPayment?.enabled) {
    return registerAutomaticFullPayment(manager, payable, autoPayment, authContext);
  }

  return {
    payable,
    payment: null,
    transaction: null,
    message: existingPayable
      ? shouldReactivate
        ? "Cuenta por pagar reactivada y sincronizada correctamente."
        : "Cuenta por pagar sincronizada correctamente."
      : "Cuenta por pagar creada correctamente.",
  };
}

"use strict";

import {
  AppDataSource,
  PayablePayment,
  Transaction,
  calculateNetAmount,
  calculatePayableAmounts,
  derivePayableState,
  getDonorOrThrow,
  getPayableAccountOrThrow,
  getPaymentProviderOrThrow,
  getTransactionCategoryOrThrow,
  getTransactionOrThrow,
  getUserOrThrow,
  mapPayablePayment,
  normalizeCurrency,
  normalizeNullableString,
  toNumericNumber,
} from "./accounting.shared.js";

function assertPayableCategoryCompatibility(category) {
  if (!category) return;

  if (!["EGRESO", "AMBOS"].includes(category.tipo)) {
    throw new Error("La categoria del pago debe ser de tipo EGRESO o AMBOS.");
  }
}

async function getPayablePaymentWithRelations(repository, paymentId) {
  return repository.findOne({
    where: { pago_cuenta_por_pagar_id: Number(paymentId) },
    relations: {
      payableAccount: {
        category: true,
        created_by: true,
      },
      transaction: {
        category: true,
        payment_provider: true,
        donor: true,
        payable_account: true,
        created_by: true,
      },
      created_by: true,
    },
  });
}

export async function createPayablePaymentService(params, body, authContext = {}) {
  try {
    const payment = await AppDataSource.transaction(async (manager) => {
      const payableRepository = manager.getRepository("PayableAccount");
      const paymentRepository = manager.getRepository(PayablePayment);
      const transactionRepository = manager.getRepository(Transaction);
      const payableId = params?.cuenta_por_pagar_id;
      const payable = await getPayableAccountOrThrow(manager, payableId);
      const amountApplied = toNumericNumber(body.monto_aplicado, NaN);
      const feeAmount = toNumericNumber(body.monto_fee, 0);

      if (amountApplied <= 0) {
        throw new Error("El monto aplicado debe ser mayor a 0.");
      }

      if (["ANULADA", "CONDONADA"].includes(payable.estado)) {
        throw new Error("No se puede pagar una cuenta por pagar anulada o condonada.");
      }

      if (payable.estado === "PAGADA" || toNumericNumber(payable.saldo_pendiente, 0) <= 0) {
        throw new Error("No se puede registrar un pago sobre una cuenta por pagar ya pagada.");
      }

      if (amountApplied > toNumericNumber(payable.saldo_pendiente, 0)) {
        throw new Error("El monto aplicado no puede ser mayor que el saldo pendiente.");
      }

      const category = await getTransactionCategoryOrThrow(
        manager,
        body.categoria_transaccion_id || payable.category?.categoria_transaccion_id,
        { optional: true },
      );
      assertPayableCategoryCompatibility(category);

      const paymentProvider = await getPaymentProviderOrThrow(
        manager,
        body.proveedor_pago_id,
        { optional: true },
      );
      const donor = await getDonorOrThrow(manager, body.donante_id, { optional: true });
      const createdBy = authContext.userId
        ? await getUserOrThrow(manager, authContext.userId)
        : null;

      let linkedTransaction = null;

      if (body.transaccion_id) {
        linkedTransaction = await getTransactionOrThrow(manager, body.transaccion_id);

        if (linkedTransaction.tipo !== "EGRESO") {
          throw new Error("La transaccion asociada al pago debe ser de tipo EGRESO.");
        }

        if (!["CONFIRMADA", "COMPLETADA"].includes(linkedTransaction.estado)) {
          throw new Error("Solo se pueden asociar transacciones confirmadas a pagos.");
        }

        const existingPayment = await paymentRepository.findOne({
          where: {
            transaction: { transaccion_id: Number(linkedTransaction.transaccion_id) },
          },
          relations: {
            transaction: true,
          },
        });

        if (existingPayment) {
          throw new Error("La transaccion indicada ya fue asociada a otro pago.");
        }

        if (
          linkedTransaction.payable_account
          && Number(linkedTransaction.payable_account.cuenta_por_pagar_id)
            !== Number(payable.cuenta_por_pagar_id)
        ) {
          throw new Error("La transaccion ya se encuentra asociada a otra cuenta por pagar.");
        }

        if (toNumericNumber(linkedTransaction.monto_neto, 0) !== amountApplied) {
          throw new Error(
            "La transaccion indicada debe tener un monto neto igual al monto aplicado del pago.",
          );
        }

        if (String(linkedTransaction.moneda || "CLP") !== String(payable.moneda || "CLP")) {
          throw new Error(
            "La transaccion indicada debe usar la misma moneda que la cuenta por pagar.",
          );
        }

        if (!linkedTransaction.payable_account) {
          linkedTransaction.payable_account = payable;
          await transactionRepository.save(linkedTransaction);
        }
      } else {
        const grossAmount = Number((amountApplied + feeAmount).toFixed(2));
        const netAmount = calculateNetAmount(grossAmount, feeAmount);

        const newTransaction = transactionRepository.create({
          tipo: "EGRESO",
          category: category
            ? { categoria_transaccion_id: Number(category.categoria_transaccion_id) }
            : null,
          payment_provider: paymentProvider
            ? { proveedor_pago_id: Number(paymentProvider.proveedor_pago_id) }
            : null,
          donor: donor ? { donante_id: Number(donor.donante_id) } : null,
          payable_account: payable,
          descripcion:
            normalizeNullableString(body.descripcion)
            || `Pago cuenta por pagar #${payable.cuenta_por_pagar_id}`,
          moneda: normalizeCurrency(body.moneda || payable.moneda),
          monto_bruto: grossAmount,
          monto_fee: feeAmount,
          monto_neto: netAmount,
          fecha_transaccion: body.fecha_pago,
          estado: "CONFIRMADA",
          referencia_externa: normalizeNullableString(body.referencia_externa),
          idempotencia_key: normalizeNullableString(body.idempotencia_key),
          created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
          metadata: {
            ...(body.metadata || {}),
            payable_payment: {
              cuenta_por_pagar_id: Number(payable.cuenta_por_pagar_id),
              monto_aplicado: amountApplied,
            },
          },
        });

        linkedTransaction = await transactionRepository.save(newTransaction);
      }

      const newPayment = paymentRepository.create({
        payableAccount: payable,
        transaction: linkedTransaction,
        monto_aplicado: amountApplied,
        fecha_pago: body.fecha_pago,
        created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
      });

      const savedPayment = await paymentRepository.save(newPayment);

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

      return getPayablePaymentWithRelations(
        paymentRepository,
        savedPayment.pago_cuenta_por_pagar_id,
      );
    });

    return [mapPayablePayment(payment), null];
  } catch (error) {
    console.error("Error al crear pago de cuenta por pagar:", error);
    return [null, error.message || "Error interno al crear pago de cuenta por pagar"];
  }
}

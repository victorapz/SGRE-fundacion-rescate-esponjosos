"use strict";

import { Brackets } from "typeorm";
import {
  AppDataSource,
  Transaction,
  buildPagedResult,
  buildPagination,
  calculateNetAmount,
  getDonorOrThrow,
  getPayableAccountOrThrow,
  getPaymentOrderOrThrow,
  getPaymentProviderOrThrow,
  getTransactionCategoryOrThrow,
  getUserOrThrow,
  mapTransaction,
  normalizeCurrency,
  normalizeNullableString,
  toDateEnd,
  toDateStart,
  toNumericNumber,
  transactionStateDbValuesForFilter,
} from "./accounting.shared.js";

function assertCategorySupportsTransactionType(category, tipo) {
  if (!category) return;

  if (category.tipo !== "AMBOS" && category.tipo !== tipo) {
    throw new Error(
      `La categoria ${category.nombre} no es compatible con transacciones de tipo ${tipo}.`,
    );
  }
}

async function getTransactionWithRelations(repository, transactionId) {
  return repository.findOne({
    where: { transaccion_id: Number(transactionId) },
    relations: {
      category: {
        categoria_padre: true,
      },
      payment_provider: true,
      payment_order: {
        payment_provider: true,
        donor: true,
      },
      donor: true,
      payable_account: true,
      created_by: true,
      payable_payments: true,
      purchase: true,
    },
  });
}

async function resolveTransactionRelations(manager, body, tipoFallback = null) {
  const tipo = body.tipo || tipoFallback;
  const category = await getTransactionCategoryOrThrow(
    manager,
    body.categoria_transaccion_id,
    { optional: true },
  );
  const paymentProvider = await getPaymentProviderOrThrow(
    manager,
    body.proveedor_pago_id,
    { optional: true },
  );
  const paymentOrder = await getPaymentOrderOrThrow(manager, body.orden_pago_id, {
    optional: true,
  });
  const donor = await getDonorOrThrow(manager, body.donante_id, { optional: true });
  const payableAccount = await getPayableAccountOrThrow(manager, body.cuenta_por_pagar_id, {
    optional: true,
  });

  if (category) {
    assertCategorySupportsTransactionType(category, tipo);
  }

  if (payableAccount && tipo !== "EGRESO") {
    throw new Error("Solo las transacciones de tipo EGRESO pueden asociarse a cuentas por pagar.");
  }

  if (paymentOrder?.payment_provider && paymentProvider) {
    if (
      Number(paymentOrder.payment_provider.proveedor_pago_id)
      !== Number(paymentProvider.proveedor_pago_id)
    ) {
      throw new Error(
        "El proveedor de pago de la transaccion debe coincidir con el proveedor de la orden de pago.",
      );
    }
  }

  if (paymentOrder?.donor && donor) {
    if (Number(paymentOrder.donor.donante_id) !== Number(donor.donante_id)) {
      throw new Error("El donante de la transaccion debe coincidir con el de la orden de pago.");
    }
  }

  return {
    category,
    paymentProvider: paymentProvider || paymentOrder?.payment_provider || null,
    paymentOrder,
    donor: donor || paymentOrder?.donor || null,
    payableAccount,
  };
}

export async function createTransactionService(body, authContext = {}) {
  try {
    const transaction = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const grossAmount = toNumericNumber(body.monto_bruto, NaN);
      const feeAmount = toNumericNumber(body.monto_fee, 0);
      const netAmount = calculateNetAmount(grossAmount, feeAmount);
      const relations = await resolveTransactionRelations(manager, body, body.tipo);
      const createdBy = authContext.userId
        ? await getUserOrThrow(manager, authContext.userId)
        : null;

      const newTransaction = repository.create({
        tipo: body.tipo,
        category: relations.category
          ? { categoria_transaccion_id: Number(relations.category.categoria_transaccion_id) }
          : null,
        payment_provider: relations.paymentProvider
          ? { proveedor_pago_id: Number(relations.paymentProvider.proveedor_pago_id) }
          : null,
        payment_order: relations.paymentOrder
          ? { orden_pago_id: Number(relations.paymentOrder.orden_pago_id) }
          : null,
        donor: relations.donor ? { donante_id: Number(relations.donor.donante_id) } : null,
        payable_account: relations.payableAccount
          ? { cuenta_por_pagar_id: Number(relations.payableAccount.cuenta_por_pagar_id) }
          : null,
        descripcion: normalizeNullableString(body.descripcion),
        moneda: normalizeCurrency(body.moneda),
        monto_bruto: grossAmount,
        monto_fee: feeAmount,
        monto_neto: netAmount,
        fecha_transaccion: body.fecha_transaccion || new Date(),
        estado: "CONFIRMADA",
        origen_tipo: normalizeNullableString(body.origen_tipo),
        origen_id: body.origen_id || null,
        referencia_externa: normalizeNullableString(body.referencia_externa),
        idempotencia_key: normalizeNullableString(body.idempotencia_key),
        created_by: createdBy ? { id_usuario: Number(createdBy.id_usuario) } : null,
        metadata: body.metadata || null,
      });

      const savedTransaction = await repository.save(newTransaction);
      return getTransactionWithRelations(repository, savedTransaction.transaccion_id);
    });

    return [mapTransaction(transaction), null];
  } catch (error) {
    console.error("Error al crear transaccion:", error);
    return [null, error.message || "Error interno al crear transaccion"];
  }
}

export async function getTransactionService(query) {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const transaction = await getTransactionWithRelations(repository, query.transaccion_id);

    if (!transaction) return [null, "Transaccion no encontrada"];

    return [mapTransaction(transaction), null];
  } catch (error) {
    console.error("Error al obtener transaccion:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getTransactionsService(query = {}) {
  try {
    const repository = AppDataSource.getRepository(Transaction);
    const { page, limit, skip } = buildPagination(query);
    const qb = repository
      .createQueryBuilder("transaction")
      .leftJoinAndSelect("transaction.category", "category")
      .leftJoinAndSelect("category.categoria_padre", "categoryParent")
      .leftJoinAndSelect("transaction.payment_provider", "paymentProvider")
      .leftJoinAndSelect("transaction.payment_order", "paymentOrder")
      .leftJoinAndSelect("transaction.donor", "donor")
      .leftJoinAndSelect("transaction.payable_account", "payableAccount")
      .leftJoinAndSelect("transaction.created_by", "createdBy")
      .orderBy("transaction.fecha_transaccion", "DESC")
      .addOrderBy("transaction.transaccion_id", "DESC")
      .skip(skip)
      .take(limit);

    if (query.tipo) {
      qb.andWhere("transaction.tipo = :tipo", { tipo: query.tipo });
    }

    if (query.categoria_transaccion_id) {
      qb.andWhere("category.categoria_transaccion_id = :categoria_transaccion_id", {
        categoria_transaccion_id: Number(query.categoria_transaccion_id),
      });
    }

    if (query.proveedor_pago_id) {
      qb.andWhere("paymentProvider.proveedor_pago_id = :proveedor_pago_id", {
        proveedor_pago_id: Number(query.proveedor_pago_id),
      });
    }

    if (query.estado) {
      qb.andWhere("transaction.estado IN (:...states)", {
        states: transactionStateDbValuesForFilter(query.estado),
      });
    }

    if (query.moneda) {
      qb.andWhere("transaction.moneda = :moneda", { moneda: normalizeCurrency(query.moneda) });
    }

    const fechaDesde = toDateStart(query.fecha_desde);
    const fechaHasta = toDateEnd(query.fecha_hasta);
    if (fechaDesde) qb.andWhere("transaction.fecha_transaccion >= :fechaDesde", { fechaDesde });
    if (fechaHasta) qb.andWhere("transaction.fecha_transaccion <= :fechaHasta", { fechaHasta });

    if (query.search) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where("transaction.descripcion ILIKE :search", { search })
            .orWhere("transaction.referencia_externa ILIKE :search", { search })
            .orWhere("transaction.idempotencia_key ILIKE :search", { search })
            .orWhere("category.nombre ILIKE :search", { search })
            .orWhere("paymentProvider.nombre ILIKE :search", { search })
            .orWhere("donor.nombre ILIKE :search", { search });
        }),
      );
    }

    const [transactions, total] = await qb.getManyAndCount();

    return [
      buildPagedResult(transactions.map(mapTransaction), total, page, limit),
      null,
    ];
  } catch (error) {
    console.error("Error al obtener transacciones:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateTransactionService(query, body, authContext = {}) {
  try {
    const transaction = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transactionFound = await getTransactionWithRelations(repository, query.transaccion_id);

      if (!transactionFound) {
        throw new Error("Transaccion no encontrada");
      }

      const hasLinkedPayablePayments = Array.isArray(transactionFound.payable_payments)
        && transactionFound.payable_payments.length > 0;

      if (
        hasLinkedPayablePayments
        && (
          body.tipo !== undefined
          || body.monto_bruto !== undefined
          || body.monto_fee !== undefined
          || body.cuenta_por_pagar_id !== undefined
        )
      ) {
        throw new Error(
          "No se pueden modificar tipo, montos ni cuenta por pagar de una transaccion asociada a pagos.",
        );
      }

      const nextTipo = body.tipo || transactionFound.tipo;
      const relations = await resolveTransactionRelations(manager, {
        ...body,
        tipo: nextTipo,
      }, nextTipo);

      const grossAmount = body.monto_bruto !== undefined
        ? toNumericNumber(body.monto_bruto, NaN)
        : toNumericNumber(transactionFound.monto_bruto, NaN);
      const feeAmount = body.monto_fee !== undefined
        ? toNumericNumber(body.monto_fee, 0)
        : toNumericNumber(transactionFound.monto_fee, 0);
      const netAmount = calculateNetAmount(grossAmount, feeAmount);

      if (body.tipo !== undefined) transactionFound.tipo = nextTipo;
      if (body.descripcion !== undefined) {
        transactionFound.descripcion = normalizeNullableString(body.descripcion);
      }
      if (body.moneda !== undefined) transactionFound.moneda = normalizeCurrency(body.moneda);
      if (body.monto_bruto !== undefined) transactionFound.monto_bruto = grossAmount;
      if (body.monto_fee !== undefined) transactionFound.monto_fee = feeAmount;
      if (body.monto_bruto !== undefined || body.monto_fee !== undefined) {
        transactionFound.monto_neto = netAmount;
      }
      if (body.fecha_transaccion !== undefined) {
        transactionFound.fecha_transaccion = body.fecha_transaccion || transactionFound.fecha_transaccion;
      }
      if (body.origen_tipo !== undefined) {
        transactionFound.origen_tipo = normalizeNullableString(body.origen_tipo);
      }
      if (body.origen_id !== undefined) transactionFound.origen_id = body.origen_id || null;
      if (body.referencia_externa !== undefined) {
        transactionFound.referencia_externa = normalizeNullableString(body.referencia_externa);
      }
      if (body.idempotencia_key !== undefined) {
        transactionFound.idempotencia_key = normalizeNullableString(body.idempotencia_key);
      }
      if (body.metadata !== undefined) transactionFound.metadata = body.metadata || null;

      if (body.categoria_transaccion_id !== undefined) {
        transactionFound.category = relations.category
          ? { categoria_transaccion_id: Number(relations.category.categoria_transaccion_id) }
          : null;
      }
      if (body.proveedor_pago_id !== undefined || body.orden_pago_id !== undefined) {
        const nextProvider = body.proveedor_pago_id !== undefined
          ? relations.paymentProvider
          : body.orden_pago_id !== undefined
            ? relations.paymentProvider || transactionFound.payment_provider
            : transactionFound.payment_provider;

        transactionFound.payment_provider = nextProvider
          ? { proveedor_pago_id: Number(nextProvider.proveedor_pago_id) }
          : null;
      }
      if (body.orden_pago_id !== undefined) {
        transactionFound.payment_order = relations.paymentOrder
          ? { orden_pago_id: Number(relations.paymentOrder.orden_pago_id) }
          : null;
      }
      if (body.donante_id !== undefined || body.orden_pago_id !== undefined) {
        const nextDonor = body.donante_id !== undefined
          ? relations.donor
          : body.orden_pago_id !== undefined
            ? relations.donor || transactionFound.donor
            : transactionFound.donor;

        transactionFound.donor = nextDonor
          ? { donante_id: Number(nextDonor.donante_id) }
          : null;
      }
      if (body.cuenta_por_pagar_id !== undefined) {
        transactionFound.payable_account = relations.payableAccount
          ? { cuenta_por_pagar_id: Number(relations.payableAccount.cuenta_por_pagar_id) }
          : null;
      }

      if (!transactionFound.created_by && authContext.userId) {
        const createdBy = await getUserOrThrow(manager, authContext.userId);
        transactionFound.created_by = { id_usuario: Number(createdBy.id_usuario) };
      }

      await repository.save(transactionFound);
      return getTransactionWithRelations(repository, transactionFound.transaccion_id);
    });

    return [mapTransaction(transaction), null];
  } catch (error) {
    console.error("Error al actualizar transaccion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

export async function cancelTransactionService(query, body = {}) {
  try {
    const transaction = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Transaction);
      const transactionFound = await getTransactionWithRelations(repository, query.transaccion_id);

      if (!transactionFound) {
        throw new Error("Transaccion no encontrada");
      }

      if (Array.isArray(transactionFound.payable_payments) && transactionFound.payable_payments.length > 0) {
        throw new Error("No se puede anular una transaccion asociada a pagos de cuentas por pagar.");
      }

      if (Array.isArray(transactionFound.purchase) && transactionFound.purchase.length > 0) {
        throw new Error("No se puede anular una transaccion asociada a compras legado.");
      }

      transactionFound.estado = "ANULADA";
      transactionFound.metadata = {
        ...(transactionFound.metadata || {}),
        anulacion: {
          motivo: normalizeNullableString(body.motivo),
          fecha: new Date().toISOString(),
        },
        ...(body.metadata || {}),
      };

      await repository.save(transactionFound);
      return getTransactionWithRelations(repository, transactionFound.transaccion_id);
    });

    return [mapTransaction(transaction), null];
  } catch (error) {
    console.error("Error al anular transaccion:", error);
    return [null, error.message || "Error interno del servidor"];
  }
}

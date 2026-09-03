"use strict";

import {
  AppDataSource,
  PayableAccount,
  Transaction,
  derivePayableState,
  mapPayableAccount,
  mapTransaction,
  normalizeCurrency,
  toDateEnd,
  toDateStart,
  toNumericNumber,
} from "./accounting.shared.js";

function buildTransactionSummaryQuery(repository, query = {}) {
  const qb = repository.createQueryBuilder("transaction");
  qb.where("transaction.estado IN (:...states)", {
    states: ["CONFIRMADA", "COMPLETADA"],
  });

  if (query.moneda) {
    qb.andWhere("transaction.moneda = :moneda", { moneda: normalizeCurrency(query.moneda) });
  }

  const fechaDesde = toDateStart(query.fecha_desde);
  const fechaHasta = toDateEnd(query.fecha_hasta);
  if (fechaDesde) qb.andWhere("transaction.fecha_transaccion >= :fechaDesde", { fechaDesde });
  if (fechaHasta) qb.andWhere("transaction.fecha_transaccion <= :fechaHasta", { fechaHasta });

  return qb;
}

function createEmptyCurrencySummary(moneda) {
  return {
    moneda: normalizeCurrency(moneda),
    total_ingresos_confirmados: 0,
    total_egresos_confirmados: 0,
    saldo_neto: 0,
    total_cuentas_por_pagar_pendientes: 0,
    total_vencido: 0,
    cantidad_cuentas_pendientes: 0,
  };
}

function getOrCreateCurrencySummary(summaryMap, moneda) {
  const normalizedCurrency = normalizeCurrency(moneda);
  if (!summaryMap.has(normalizedCurrency)) {
    summaryMap.set(normalizedCurrency, createEmptyCurrencySummary(normalizedCurrency));
  }
  return summaryMap.get(normalizedCurrency);
}

function sortCurrencySummaries(summaries, preferredCurrency = "CLP") {
  const normalizedPreferred = normalizeCurrency(preferredCurrency);
  return [...summaries].sort((left, right) => {
    if (left.moneda === normalizedPreferred && right.moneda !== normalizedPreferred) return -1;
    if (right.moneda === normalizedPreferred && left.moneda !== normalizedPreferred) return 1;
    return left.moneda.localeCompare(right.moneda, "es");
  });
}

export async function getAccountingDashboardService(query = {}) {
  try {
    const transactionRepository = AppDataSource.getRepository(Transaction);
    const payableRepository = AppDataSource.getRepository(PayableAccount);
    const latestLimit = Math.min(Number(query.latest_limit) || 5, 20);
    const upcomingLimit = Math.min(Number(query.upcoming_limit) || 5, 20);
    const preferredCurrency = normalizeCurrency(query.moneda || "CLP");

    const incomeRows = await buildTransactionSummaryQuery(transactionRepository, query)
      .andWhere("transaction.tipo = :tipo", { tipo: "INGRESO" })
      .select("transaction.moneda", "moneda")
      .addSelect("COALESCE(SUM(transaction.monto_neto), 0)", "total")
      .groupBy("transaction.moneda")
      .getRawMany();

    const expenseRows = await buildTransactionSummaryQuery(transactionRepository, query)
      .andWhere("transaction.tipo = :tipo", { tipo: "EGRESO" })
      .select("transaction.moneda", "moneda")
      .addSelect("COALESCE(SUM(transaction.monto_neto), 0)", "total")
      .groupBy("transaction.moneda")
      .getRawMany();

    const latestTransactions = await buildTransactionSummaryQuery(transactionRepository, query)
      .leftJoinAndSelect("transaction.category", "category")
      .leftJoinAndSelect("category.categoria_padre", "categoryParent")
      .leftJoinAndSelect("transaction.payment_provider", "paymentProvider")
      .leftJoinAndSelect("transaction.payment_order", "paymentOrder")
      .leftJoinAndSelect("transaction.donor", "donor")
      .leftJoinAndSelect("transaction.payable_account", "payableAccount")
      .leftJoinAndSelect("transaction.created_by", "createdBy")
      .orderBy("transaction.fecha_transaccion", "DESC")
      .addOrderBy("transaction.transaccion_id", "DESC")
      .take(latestLimit)
      .getMany();

    const payableQuery = payableRepository
      .createQueryBuilder("payable")
      .leftJoinAndSelect("payable.category", "category")
      .leftJoinAndSelect("category.categoria_padre", "categoryParent")
      .leftJoinAndSelect("payable.created_by", "createdBy")
      .where("payable.saldo_pendiente > 0")
      .andWhere("payable.estado NOT IN (:...excludedStates)", {
        excludedStates: ["ANULADA", "CONDONADA", "PAGADA"],
      });

    if (query.moneda) {
      payableQuery.andWhere("payable.moneda = :moneda", {
        moneda: normalizeCurrency(query.moneda),
      });
    }

    const fechaDesde = toDateStart(query.fecha_desde);
    const fechaHasta = toDateEnd(query.fecha_hasta);
    if (fechaDesde) payableQuery.andWhere("payable.fecha_emision >= :fechaDesde", { fechaDesde });
    if (fechaHasta) payableQuery.andWhere("payable.fecha_emision <= :fechaHasta", { fechaHasta });

    const pendingPayables = await payableQuery.getMany();
    const today = new Date().toISOString().slice(0, 10);
    const summaryMap = new Map();

    if (query.moneda) {
      getOrCreateCurrencySummary(summaryMap, preferredCurrency);
    }

    incomeRows.forEach((row) => {
      const summary = getOrCreateCurrencySummary(summaryMap, row.moneda);
      summary.total_ingresos_confirmados = Number(Number(row.total || 0).toFixed(2));
    });

    expenseRows.forEach((row) => {
      const summary = getOrCreateCurrencySummary(summaryMap, row.moneda);
      summary.total_egresos_confirmados = Number(Number(row.total || 0).toFixed(2));
    });

    pendingPayables.forEach((payable) => {
      const summary = getOrCreateCurrencySummary(summaryMap, payable.moneda);
      const derivedState = derivePayableState({
        estadoActual: payable.estado,
        montoTotal: payable.monto_total,
        montoPagado: payable.monto_pagado,
        fechaVencimiento: payable.fecha_vencimiento,
      });
      const balance = toNumericNumber(payable.saldo_pendiente, 0);

      summary.total_cuentas_por_pagar_pendientes += balance;
      summary.cantidad_cuentas_pendientes += 1;

      if (
        derivedState === "VENCIDA"
        || (payable.fecha_vencimiento && String(payable.fecha_vencimiento) < today)
      ) {
        summary.total_vencido += balance;
      }
    });

    if (summaryMap.size === 0) {
      getOrCreateCurrencySummary(summaryMap, preferredCurrency);
    }

    const currencySummaries = sortCurrencySummaries([...summaryMap.values()], preferredCurrency)
      .map((summary) => ({
        ...summary,
        total_ingresos_confirmados: Number(summary.total_ingresos_confirmados.toFixed(2)),
        total_egresos_confirmados: Number(summary.total_egresos_confirmados.toFixed(2)),
        saldo_neto: Number(
          (summary.total_ingresos_confirmados - summary.total_egresos_confirmados).toFixed(2),
        ),
        total_cuentas_por_pagar_pendientes: Number(
          summary.total_cuentas_por_pagar_pendientes.toFixed(2),
        ),
        total_vencido: Number(summary.total_vencido.toFixed(2)),
        cantidad_cuentas_pendientes: Number(summary.cantidad_cuentas_pendientes || 0),
      }));

    const primarySummary = currencySummaries.find(
      (summary) => summary.moneda === preferredCurrency,
    ) || currencySummaries[0] || createEmptyCurrencySummary(preferredCurrency);

    const upcomingPayables = [...pendingPayables]
      .filter((payable) => payable.fecha_vencimiento)
      .sort((left, right) =>
        String(left.fecha_vencimiento).localeCompare(String(right.fecha_vencimiento)))
      .slice(0, upcomingLimit);

    return [
      {
        resumen: {
          moneda_principal: primarySummary.moneda,
          monedas: currencySummaries,
          por_moneda: currencySummaries,
          // Campos legacy: representan la moneda principal, no una suma global mezclada.
          total_ingresos_confirmados: primarySummary.total_ingresos_confirmados,
          total_egresos_confirmados: primarySummary.total_egresos_confirmados,
          saldo_neto: primarySummary.saldo_neto,
          total_cuentas_por_pagar_pendientes:
            primarySummary.total_cuentas_por_pagar_pendientes,
          total_vencido: primarySummary.total_vencido,
          cantidad_cuentas_pendientes: primarySummary.cantidad_cuentas_pendientes,
        },
        ultimas_transacciones: latestTransactions.map(mapTransaction),
        proximas_cuentas_por_vencer: upcomingPayables.map(mapPayableAccount),
      },
      null,
    ];
  } catch (error) {
    console.error("Error al obtener dashboard contable:", error);
    return [null, "Error interno del servidor"];
  }
}

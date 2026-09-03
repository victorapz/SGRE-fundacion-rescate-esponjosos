"use strict";

import { In } from "typeorm";
import {
  AppDataSource,
  PaymentOrder,
  Transaction,
  buildPagination,
  mapDonorSummary,
  mapPaymentProvider,
  normalizeCurrency,
  normalizeNullableString,
  toDateOnly,
  toIsoTimestamp,
  toNumericNumber,
} from "./accounting.shared.js";
import {
  getDonationRefundEligibility,
} from "../paypal/paypalDonation.service.js";

const DONATION_PURPOSE = "DONACION_UNICA";
const DONATION_CAPTURE_CATEGORY_KEY = "DONACION_UNICA";
const DONATION_REFUND_CATEGORY_KEY = "DEVOLUCION_DONACION";
const DONATION_REVERSAL_CATEGORY_KEY = "REVERSA_PAYPAL";
const CONFIRMED_VISIBLE_STATES = new Set([
  "CAPTURADA",
  "REEMBOLSADA_PARCIAL",
  "REEMBOLSADA_TOTAL",
  "REVERTIDA",
]);

function sumMoney(values = []) {
  return Number(
    values.reduce((total, currentValue) => total + toNumericNumber(currentValue, 0), 0).toFixed(2),
  );
}

function isAnonymousDonation(order) {
  return String(order?.metadata?.donor_identity_mode || "").toUpperCase() === "ANONYMOUS";
}

function getTransactionOrderId(transaction) {
  return Number(transaction?.payment_order?.orden_pago_id || 0) || null;
}

function getTransactionDateValue(transaction) {
  return transaction?.fecha_transaccion
    ? new Date(transaction.fecha_transaccion).getTime()
    : 0;
}

function getRefundTransactions(transactions = []) {
  return transactions.filter((transaction) =>
    transaction?.tipo === "EGRESO"
    && (
      String(transaction?.metadata?.adjustment_type || "").toUpperCase() === "REFUND"
      || transaction?.category?.clave === DONATION_REFUND_CATEGORY_KEY
    ));
}

function buildRefundHistory(refundTransactions = []) {
  return [...refundTransactions]
    .sort((left, right) => getTransactionDateValue(right) - getTransactionDateValue(left))
    .map((transaction) => ({
      transaccion_id: Number(transaction?.transaccion_id || 0),
      fecha_reembolso: toIsoTimestamp(transaction?.fecha_transaccion),
      monto: toNumericNumber(transaction?.monto_bruto, 0),
      moneda: normalizeCurrency(transaction?.moneda),
      paypal_refund_id: normalizeNullableString(
        transaction?.metadata?.paypal_refund_id
          || transaction?.metadata?.refund_fact_id
          || transaction?.referencia_externa,
      ),
      motivo: normalizeNullableString(transaction?.metadata?.refund_reason),
      referencia_externa: normalizeNullableString(transaction?.referencia_externa),
    }));
}

function getReversalTransactions(transactions = []) {
  return transactions.filter((transaction) =>
    transaction?.tipo === "EGRESO"
    && (
      String(transaction?.metadata?.adjustment_type || "").toUpperCase() === "REVERSAL"
      || transaction?.category?.clave === DONATION_REVERSAL_CATEGORY_KEY
    ));
}

function getCanonicalCaptureTransaction(order, transactions = []) {
  const paypalCaptureId = normalizeNullableString(order?.metadata?.paypal?.capture_id);
  const donationCaptureTransactions = transactions
    .filter((transaction) =>
      transaction?.tipo === "INGRESO"
      && (
        transaction?.category?.clave === DONATION_CAPTURE_CATEGORY_KEY
        || String(transaction?.idempotencia_key || "").startsWith("paypal:capture:")
      ));

  const rankedTransactions = donationCaptureTransactions.sort(
    (left, right) => getTransactionDateValue(right) - getTransactionDateValue(left),
  );

  if (paypalCaptureId) {
    const matchedByCaptureId = rankedTransactions.find(
      (transaction) => normalizeNullableString(transaction?.referencia_externa) === paypalCaptureId,
    );

    if (matchedByCaptureId) {
      return matchedByCaptureId;
    }
  }

  return rankedTransactions[0] || null;
}

function deriveRefundSummary(order, refundTransactions = []) {
  const metadataSummary = order?.metadata?.refund_summary || null;
  const metadataTotalRefunded = metadataSummary?.total_refunded;
  const metadataRemainingAmount = metadataSummary?.remaining_amount;

  const totalRefunded = metadataTotalRefunded !== undefined
    ? toNumericNumber(metadataTotalRefunded, 0)
    : sumMoney(refundTransactions.map((transaction) => transaction?.monto_bruto || 0));
  const remainingAmount = metadataRemainingAmount !== undefined
    ? toNumericNumber(metadataRemainingAmount, 0)
    : Math.max(toNumericNumber(order?.monto_bruto, 0) - totalRefunded, 0);
  const fullyRefunded = metadataSummary?.fully_refunded === true || (
    totalRefunded > 0
    && remainingAmount <= 0
  );

  let refundStatus = "NONE";
  if (fullyRefunded) {
    refundStatus = "FULL";
  } else if (totalRefunded > 0 || refundTransactions.length > 0) {
    refundStatus = "PARTIAL";
  }

  const latestRefundTransaction = [...refundTransactions].sort(
    (left, right) => getTransactionDateValue(right) - getTransactionDateValue(left),
  )[0] || null;

  return {
    totalRefunded,
    remainingAmount,
    refundStatus,
    fullyRefunded,
    lastRefundId: normalizeNullableString(
      metadataSummary?.last_refund_id || latestRefundTransaction?.referencia_externa,
    ),
    lastRefundAt: toIsoTimestamp(latestRefundTransaction?.fecha_transaccion),
  };
}

function deriveReversalSummary(order, reversalTransactions = []) {
  const metadataSummary = order?.metadata?.reversal_summary || null;
  const latestReversalTransaction = [...reversalTransactions].sort(
    (left, right) => getTransactionDateValue(right) - getTransactionDateValue(left),
  )[0] || null;
  const reversalFactId = normalizeNullableString(
    metadataSummary?.reversal_fact_id
      || latestReversalTransaction?.referencia_externa,
  );

  return {
    hasReversal: Boolean(reversalFactId || reversalTransactions.length > 0),
    reversalFactId,
    paypalEventId: normalizeNullableString(metadataSummary?.paypal_event_id),
    reversedAt: toIsoTimestamp(latestReversalTransaction?.fecha_transaccion),
  };
}

export function deriveDonationVisibleStatus(order, { refundSummary, reversalSummary }) {
  if (reversalSummary?.hasReversal) return "REVERTIDA";
  if (refundSummary?.refundStatus === "FULL") return "REEMBOLSADA_TOTAL";
  if (refundSummary?.refundStatus === "PARTIAL") return "REEMBOLSADA_PARCIAL";

  switch (String(order?.estado || "").toUpperCase()) {
    case "CAPTURADA":
      return "CAPTURADA";
    case "FALLIDA":
      return "FALLIDA";
    case "CANCELADA":
      return "CANCELADA";
    case "EXPIRADA":
      return "EXPIRADA";
    case "REEMBOLSADA":
      return "REEMBOLSADA_TOTAL";
    case "CREADA":
    case "APROBADA":
    default:
      return "PENDIENTE";
  }
}

export function buildAccountingDonationItem(order, transactions = []) {
  const captureTransaction = getCanonicalCaptureTransaction(order, transactions);
  const refundTransactions = getRefundTransactions(transactions);
  const reversalTransactions = getReversalTransactions(transactions);
  const refundSummary = deriveRefundSummary(order, refundTransactions);
  const reversalSummary = deriveReversalSummary(order, reversalTransactions);
  const refundHistory = buildRefundHistory(refundTransactions);
  const anonymous = isAnonymousDonation(order);
  const donor = anonymous ? null : mapDonorSummary(order?.donor);
  const visibleStatus = deriveDonationVisibleStatus(order, {
    refundSummary,
    reversalSummary,
  });
  const refundEligibility = getDonationRefundEligibility(order, captureTransaction, {
    remainingAmount: refundSummary.remainingAmount,
    hasReversal: reversalSummary.hasReversal,
  });

  return {
    orden_pago_id: Number(order?.orden_pago_id),
    fecha_creacion: toIsoTimestamp(order?.createdAt),
    fecha_captura: toIsoTimestamp(order?.capturada_en || captureTransaction?.fecha_transaccion),
    fecha_principal: toIsoTimestamp(order?.capturada_en || captureTransaction?.fecha_transaccion || order?.createdAt),
    estado_orden_pago: order?.estado || "",
    estado_transaccion: captureTransaction?.estado || null,
    estado_visible: visibleStatus,
    moneda: normalizeCurrency(order?.moneda),
    monto_bruto: toNumericNumber(order?.monto_bruto, 0),
    monto_fee: toNumericNumber(captureTransaction?.monto_fee, 0),
    monto_neto: toNumericNumber(captureTransaction?.monto_neto, 0),
    total_reembolsado: refundSummary.totalRefunded,
    saldo_no_reembolsado: refundSummary.remainingAmount,
    estado_reembolso: reversalSummary.hasReversal
      ? "REVERSED"
      : refundSummary.refundStatus,
    proveedor_pago: mapPaymentProvider(order?.payment_provider),
    paypal_order_id: order?.proveedor_orden_id || null,
    paypal_capture_id: normalizeNullableString(
      captureTransaction?.referencia_externa
        || order?.metadata?.paypal?.capture_id,
    ),
    referencia_externa: normalizeNullableString(captureTransaction?.referencia_externa),
    anonymous,
    donor,
    reembolso_habilitado: refundEligibility.canRefund,
    reembolso_motivo_bloqueo: refundEligibility.reason,
    reembolso_fecha_confirmacion: toIsoTimestamp(refundEligibility.refundWindow.confirmedAt),
    reembolso_disponible_hasta: toIsoTimestamp(refundEligibility.refundWindow.availableUntil),
    reembolso_dentro_de_plazo: refundEligibility.refundWindow.withinWindow,
    reembolso_ms_restantes: refundEligibility.refundWindow.remainingMs,
    transaccion_captura: captureTransaction
      ? {
          transaccion_id: Number(captureTransaction.transaccion_id),
          fecha_transaccion: toIsoTimestamp(captureTransaction.fecha_transaccion),
          estado: captureTransaction.estado || "",
          referencia_externa: captureTransaction.referencia_externa || null,
        }
      : null,
    refund: {
      total_reembolsado: refundSummary.totalRefunded,
      saldo_no_reembolsado: refundSummary.remainingAmount,
      estado: refundSummary.refundStatus,
      ultimo_refund_id: refundSummary.lastRefundId,
      ultima_fecha_reembolso: refundSummary.lastRefundAt,
      historial: refundHistory,
    },
    reversal: {
      tiene_reversa: reversalSummary.hasReversal,
      reversal_fact_id: reversalSummary.reversalFactId,
      paypal_event_id: reversalSummary.paypalEventId,
      fecha_reversa: reversalSummary.reversedAt,
    },
  };
}

function buildSearchHaystack(item) {
  return [
    item?.donor?.nombre,
    item?.donor?.apellido,
    item?.donor?.email,
    item?.paypal_order_id,
    item?.paypal_capture_id,
    item?.referencia_externa,
    item?.proveedor_pago?.nombre,
    item?.proveedor_pago?.clave,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesDateRange(item, query = {}) {
  const itemDate = toDateOnly(item?.fecha_principal);
  if (!itemDate) return false;
  if (query.date_from && itemDate < toDateOnly(query.date_from)) return false;
  if (query.date_to && itemDate > toDateOnly(query.date_to)) return false;
  return true;
}

export function matchesAccountingDonationFilters(item, query = {}) {
  if (query.status && item?.estado_visible !== query.status) {
    return false;
  }

  if (query.currency && normalizeCurrency(item?.moneda) !== normalizeCurrency(query.currency)) {
    return false;
  }

  if (query.provider && Number(item?.proveedor_pago?.proveedor_pago_id) !== Number(query.provider)) {
    return false;
  }

  if (typeof query.anonymous === "boolean" && Boolean(item?.anonymous) !== query.anonymous) {
    return false;
  }

  if (query.refund_status) {
    const normalizedRefundStatus = String(query.refund_status).toUpperCase();
    if (normalizedRefundStatus !== String(item?.estado_reembolso || "").toUpperCase()) {
      return false;
    }
  }

  if ((query.date_from || query.date_to) && !matchesDateRange(item, query)) {
    return false;
  }

  if (query.search) {
    const normalizedSearch = String(query.search).trim().toLowerCase();
    if (!buildSearchHaystack(item).includes(normalizedSearch)) {
      return false;
    }
  }

  return true;
}

function resolveDonationSortValue(item, sortBy) {
  switch (sortBy) {
    case "created_at":
      return new Date(item?.fecha_creacion || 0).getTime();
    case "gross_amount":
      return toNumericNumber(item?.monto_bruto, 0);
    case "fee_amount":
      return toNumericNumber(item?.monto_fee, 0);
    case "net_amount":
      return toNumericNumber(item?.monto_neto, 0);
    case "refunded_amount":
      return toNumericNumber(item?.total_reembolsado, 0);
    case "donor_name":
      return String(
        [item?.donor?.nombre, item?.donor?.apellido].filter(Boolean).join(" ").trim() || "Anonimo",
      ).toLowerCase();
    case "captured_at":
    default:
      return new Date(item?.fecha_captura || item?.fecha_creacion || 0).getTime();
  }
}

export function sortAccountingDonations(items = [], query = {}) {
  const sortBy = query.sort_by || "captured_at";
  const sortDirection = String(query.sort_order || "desc").toLowerCase() === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = resolveDonationSortValue(left, sortBy);
    const rightValue = resolveDonationSortValue(right, sortBy);

    if (leftValue < rightValue) return -1 * sortDirection;
    if (leftValue > rightValue) return 1 * sortDirection;

    return Number(right?.orden_pago_id || 0) - Number(left?.orden_pago_id || 0);
  });
}

export function buildAccountingDonationSummary(items = []) {
  const groupedByCurrency = items.reduce((summary, item) => {
    const currency = normalizeCurrency(item?.moneda);
    if (!summary[currency]) {
      summary[currency] = {
        moneda: currency,
        cantidad_donaciones_confirmadas: 0,
        monto_bruto_confirmado: 0,
        monto_fee_total: 0,
        monto_neto_recibido: 0,
        monto_total_reembolsado: 0,
        cantidad_anonimas: 0,
      };
    }

    if (CONFIRMED_VISIBLE_STATES.has(item?.estado_visible)) {
      summary[currency].cantidad_donaciones_confirmadas += 1;
      summary[currency].monto_bruto_confirmado = Number(
        (summary[currency].monto_bruto_confirmado + toNumericNumber(item?.monto_bruto, 0)).toFixed(2),
      );
      summary[currency].monto_fee_total = Number(
        (summary[currency].monto_fee_total + toNumericNumber(item?.monto_fee, 0)).toFixed(2),
      );
      summary[currency].monto_neto_recibido = Number(
        (summary[currency].monto_neto_recibido + toNumericNumber(item?.monto_neto, 0)).toFixed(2),
      );
      summary[currency].monto_total_reembolsado = Number(
        (summary[currency].monto_total_reembolsado + toNumericNumber(item?.total_reembolsado, 0)).toFixed(2),
      );

      if (item?.anonymous) {
        summary[currency].cantidad_anonimas += 1;
      }
    }

    return summary;
  }, {});

  return {
    by_currency: Object.values(groupedByCurrency),
  };
}

export async function getAccountingDonationsService(query = {}) {
  try {
    const { page, limit, skip } = buildPagination(query);
    const paymentOrderRepository = AppDataSource.getRepository(PaymentOrder);
    const transactionRepository = AppDataSource.getRepository(Transaction);

    const orderWhere = {
      proposito: DONATION_PURPOSE,
    };

    if (query.provider) {
      orderWhere.payment_provider = { proveedor_pago_id: Number(query.provider) };
    }

    if (query.currency) {
      orderWhere.moneda = normalizeCurrency(query.currency);
    }

    const orders = await paymentOrderRepository.find({
      where: orderWhere,
      relations: {
        payment_provider: true,
        donor: true,
      },
      order: {
        capturada_en: "DESC",
        createdAt: "DESC",
        orden_pago_id: "DESC",
      },
    });

    if (!orders.length) {
      return [{
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
        summary: {
          by_currency: [],
        },
      }, null];
    }

    const orderIds = orders.map((order) => Number(order.orden_pago_id));
    const transactions = await transactionRepository.find({
      where: {
        payment_order: {
          orden_pago_id: In(orderIds),
        },
      },
      relations: {
        category: true,
        payment_provider: true,
        payment_order: true,
        donor: true,
      },
    });

    const transactionsByOrderId = transactions.reduce((grouped, transaction) => {
      const orderId = getTransactionOrderId(transaction);
      if (!orderId) return grouped;

      if (!grouped[orderId]) {
        grouped[orderId] = [];
      }

      grouped[orderId].push(transaction);
      return grouped;
    }, {});

    const mappedItems = orders.map((order) =>
      buildAccountingDonationItem(
        order,
        transactionsByOrderId[Number(order.orden_pago_id)] || [],
      ));
    const filteredItems = mappedItems.filter((item) => matchesAccountingDonationFilters(item, query));
    const sortedItems = sortAccountingDonations(filteredItems, query);
    const pagedItems = sortedItems.slice(skip, skip + limit);

    return [{
      items: pagedItems,
      pagination: {
        page,
        limit,
        total: sortedItems.length,
        totalPages: Math.max(Math.ceil(sortedItems.length / limit), 1),
      },
      summary: buildAccountingDonationSummary(filteredItems),
    }, null];
  } catch (error) {
    console.error("Error al obtener donaciones monetarias administrativas:", error);
    return [null, "Error interno del servidor"];
  }
}

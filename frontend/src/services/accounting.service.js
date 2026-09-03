import api from "../api/axios";

function buildError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  const details = error?.response?.data?.details;

  if (Array.isArray(details) && details.length > 0) {
    return new Error(`${message}: ${details.join(", ")}`);
  }

  if (details && typeof details === "string") {
    return new Error(`${message}: ${details}`);
  }

  return new Error(message);
}

function extractData(response) {
  return response?.data?.data ?? null;
}

function emptyPagination() {
  return {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
}

function normalizePagedResponse(response, itemNormalizer) {
  const data = extractData(response);
  const items = Array.isArray(data?.items) ? data.items.map(itemNormalizer) : [];

  return {
    items,
    pagination: {
      ...emptyPagination(),
      ...(data?.pagination || {}),
    },
  };
}

function normalizeUserSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.id_usuario || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    email: item.email || "",
  };
}

function normalizeDonorSummary(item = {}) {
  if (!item) return null;

  return {
    id: item.donante_id || "",
    nombre: item.nombre || "",
    apellido: item.apellido || "",
    nombreCompleto: [item.nombre, item.apellido].filter(Boolean).join(" ").trim(),
    telefono: item.telefono || "",
    email: item.email || "",
    instagram: item.usuario_instagram || "",
  };
}

function normalizeAccountingDonationSummary(item = {}) {
  if (!item) return null;

  return {
    moneda: item.moneda || "USD",
    cantidadDonacionesConfirmadas: Number(item.cantidad_donaciones_confirmadas || 0),
    montoBrutoConfirmado: Number(item.monto_bruto_confirmado || 0),
    montoFeeTotal: Number(item.monto_fee_total || 0),
    montoNetoRecibido: Number(item.monto_neto_recibido || 0),
    montoTotalReembolsado: Number(item.monto_total_reembolsado || 0),
    cantidadAnonimas: Number(item.cantidad_anonimas || 0),
  };
}

function normalizeAccountingDonation(item = {}) {
  if (!item) return null;

  return {
    id: item.orden_pago_id || "",
    paymentOrderId: item.orden_pago_id || "",
    createdAt: item.fecha_creacion || "",
    capturedAt: item.fecha_captura || "",
    primaryDate: item.fecha_principal || item.fecha_captura || item.fecha_creacion || "",
    paymentOrderStatus: item.estado_orden_pago || "",
    transactionStatus: item.estado_transaccion || "",
    visibleStatus: item.estado_visible || "",
    currency: item.moneda || "USD",
    grossAmount: Number(item.monto_bruto || 0),
    feeAmount: Number(item.monto_fee || 0),
    netAmount: Number(item.monto_neto || 0),
    totalRefunded: Number(item.total_reembolsado || 0),
    remainingAmount: Number(item.saldo_no_reembolsado || 0),
    refundStatus: item.estado_reembolso || "NONE",
    paymentProvider: normalizePaymentProvider(item.proveedor_pago),
    paypalOrderId: item.paypal_order_id || "",
    paypalCaptureId: item.paypal_capture_id || "",
    referenceExternal: item.referencia_externa || "",
    anonymous: Boolean(item.anonymous),
    donor: normalizeDonorSummary(item.donor),
    refundAllowed: Boolean(item.reembolso_habilitado),
    refundBlockedReason: item.reembolso_motivo_bloqueo || "",
    refundWindow: {
      confirmedAt: item.reembolso_fecha_confirmacion || "",
      availableUntil: item.reembolso_disponible_hasta || "",
      isWithinWindow: Boolean(item.reembolso_dentro_de_plazo),
      remainingMs: Number(item.reembolso_ms_restantes || 0),
    },
    captureTransaction: item.transaccion_captura
      ? {
          id: item.transaccion_captura.transaccion_id || "",
          fechaTransaccion: item.transaccion_captura.fecha_transaccion || "",
          estado: item.transaccion_captura.estado || "",
          referenciaExterna: item.transaccion_captura.referencia_externa || "",
        }
      : null,
    refund: item.refund
      ? {
          totalRefunded: Number(item.refund.total_reembolsado || 0),
          remainingAmount: Number(item.refund.saldo_no_reembolsado || 0),
          status: item.refund.estado || "NONE",
          lastRefundId: item.refund.ultimo_refund_id || "",
          lastRefundAt: item.refund.ultima_fecha_reembolso || "",
          history: Array.isArray(item.refund.historial)
            ? item.refund.historial.map((historyItem) => ({
                id: historyItem.transaccion_id || "",
                refundedAt: historyItem.fecha_reembolso || "",
                amount: Number(historyItem.monto || 0),
                currency: historyItem.moneda || item.moneda || "USD",
                paypalRefundId: historyItem.paypal_refund_id || "",
                reason: historyItem.motivo || "",
                referenceExternal: historyItem.referencia_externa || "",
              }))
            : [],
        }
      : null,
    reversal: item.reversal
      ? {
          hasReversal: Boolean(item.reversal.tiene_reversa),
          reversalFactId: item.reversal.reversal_fact_id || "",
          paypalEventId: item.reversal.paypal_event_id || "",
          reversedAt: item.reversal.fecha_reversa || "",
        }
      : null,
  };
}

function normalizeCategory(item = {}) {
  if (!item) return null;

  return {
    id: item.categoria_transaccion_id || "",
    clave: item.clave || "",
    nombre: item.nombre || "",
    tipo: item.tipo || "",
    descripcion: item.descripcion || "",
    activo: Boolean(item.activo),
    esSistema: Boolean(item.es_sistema),
    categoriaPadreId: item.categoria_padre_id || "",
    categoriaPadre: item.categoria_padre
      ? {
          id: item.categoria_padre.categoria_transaccion_id || "",
          clave: item.categoria_padre.clave || "",
          nombre: item.categoria_padre.nombre || "",
        }
      : null,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizePaymentProvider(item = {}) {
  if (!item) return null;

  return {
    id: item.proveedor_pago_id || "",
    clave: item.clave || "",
    nombre: item.nombre || "",
    tipo: item.tipo || "",
    activo: Boolean(item.activo),
    metadataPublica: item.metadata_publica || null,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizePaymentOrder(item = {}) {
  if (!item) return null;

  return {
    id: item.orden_pago_id || "",
    proveedorOrdenId: item.proveedor_orden_id || "",
    proposito: item.proposito || "",
    moneda: item.moneda || "CLP",
    montoBruto: Number(item.monto_bruto || 0),
    estado: item.estado || "",
    approvalUrl: item.approval_url || "",
    fechaExpiracion: item.fecha_expiracion || "",
    capturadaEn: item.capturada_en || "",
    metadata: item.metadata || null,
    paymentProvider: normalizePaymentProvider(item.payment_provider),
    donor: normalizeDonorSummary(item.donor),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeTransaction(item = {}) {
  if (!item) return null;

  return {
    id: item.transaccion_id || "",
    tipo: item.tipo || "",
    descripcion: item.descripcion || "",
    moneda: item.moneda || "CLP",
    montoBruto: Number(item.monto_bruto || 0),
    montoFee: Number(item.monto_fee || 0),
    montoNeto: Number(item.monto_neto || 0),
    fechaTransaccion: item.fecha_transaccion || "",
    estado: item.estado || "",
    origenTipo: item.origen_tipo || "",
    origenId: item.origen_id ?? null,
    referenciaExterna: item.referencia_externa || "",
    idempotenciaKey: item.idempotencia_key || "",
    metadata: item.metadata || null,
    category: normalizeCategory(item.category),
    paymentProvider: normalizePaymentProvider(item.payment_provider),
    paymentOrder: item.payment_order
      ? {
          id: item.payment_order.orden_pago_id || "",
          proposito: item.payment_order.proposito || "",
          estado: item.payment_order.estado || "",
        }
      : null,
    donor: normalizeDonorSummary(item.donor),
    payableAccount: item.payable_account
      ? {
          id: item.payable_account.cuenta_por_pagar_id || "",
          estado: item.payable_account.estado || "",
          saldoPendiente: Number(item.payable_account.saldo_pendiente || 0),
        }
      : null,
    createdBy: normalizeUserSummary(item.created_by),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizePayablePayment(item = {}) {
  if (!item) return null;

  return {
    id: item.pago_cuenta_por_pagar_id || "",
    montoAplicado: Number(item.monto_aplicado || 0),
    fechaPago: item.fecha_pago || "",
    payableAccount: item.payable_account
      ? {
          id: item.payable_account.cuenta_por_pagar_id || "",
          estado: item.payable_account.estado || "",
          saldoPendiente: Number(item.payable_account.saldo_pendiente || 0),
        }
      : null,
    transaction: normalizeTransaction(item.transaction),
    createdBy: normalizeUserSummary(item.created_by),
    createdAt: item.createdAt || "",
  };
}

function normalizePayable(item = {}) {
  if (!item) return null;

  return {
    id: item.cuenta_por_pagar_id || "",
    origenTipo: item.origen_tipo || "",
    origenId: item.origen_id ?? null,
    proveedorTipo: item.proveedor_tipo || "",
    proveedorId: item.proveedor_id ?? null,
    descripcion: item.descripcion || "",
    moneda: item.moneda || "CLP",
    montoTotal: Number(item.monto_total || 0),
    montoPagado: Number(item.monto_pagado || 0),
    saldoPendiente: Number(item.saldo_pendiente || 0),
    fechaEmision: item.fecha_emision || "",
    fechaVencimiento: item.fecha_vencimiento || "",
    estado: item.estado || "",
    metadata: item.metadata || null,
    category: normalizeCategory(item.category),
    createdBy: normalizeUserSummary(item.created_by),
    payments: Array.isArray(item.payments)
      ? item.payments.map(normalizePayablePayment)
      : [],
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

function normalizeWebhookLog(item = {}) {
  if (!item) return null;

  return {
    id: item.webhook_log_id || "",
    eventoTipo: item.evento_tipo || "",
    proveedorEventoId: item.proveedor_evento_id || "",
    payloadSanitizado: item.payload_sanitizado || null,
    headersSanitizados: item.headers_sanitizados || null,
    firmaVerificada: Boolean(item.firma_verificada),
    estado: item.estado || "",
    recibidoEn: item.recibido_en || "",
    procesadoEn: item.procesado_en || "",
    intentos: Number(item.intentos || 0),
    errorMensaje: item.error_mensaje || "",
    referenciaTipo: item.referencia_tipo || "",
    referenciaId: item.referencia_id ?? null,
    paymentProvider: normalizePaymentProvider(item.payment_provider),
    createdAt: item.createdAt || "",
  };
}

function normalizeDashboardCurrencySummary(item = {}) {
  return {
    moneda: item.moneda || "CLP",
    totalIngresosConfirmados: Number(item.total_ingresos_confirmados || 0),
    totalEgresosConfirmados: Number(item.total_egresos_confirmados || 0),
    saldoNeto: Number(item.saldo_neto || 0),
    totalCuentasPorPagarPendientes: Number(item.total_cuentas_por_pagar_pendientes || 0),
    totalVencido: Number(item.total_vencido || 0),
    cantidadCuentasPendientes: Number(item.cantidad_cuentas_pendientes || 0),
  };
}

function normalizeDashboard(item = {}) {
  const rawCurrencySummaries = Array.isArray(item?.resumen?.monedas)
    ? item.resumen.monedas
    : Array.isArray(item?.resumen?.por_moneda)
      ? item.resumen.por_moneda
      : [];

  const fallbackCurrency = item?.resumen?.moneda_principal || "CLP";
  const currencySummaries = rawCurrencySummaries.length
    ? rawCurrencySummaries.map(normalizeDashboardCurrencySummary)
    : [
        normalizeDashboardCurrencySummary({
          moneda: fallbackCurrency,
          total_ingresos_confirmados: item?.resumen?.total_ingresos_confirmados,
          total_egresos_confirmados: item?.resumen?.total_egresos_confirmados,
          saldo_neto: item?.resumen?.saldo_neto,
          total_cuentas_por_pagar_pendientes:
            item?.resumen?.total_cuentas_por_pagar_pendientes,
          total_vencido: item?.resumen?.total_vencido,
          cantidad_cuentas_pendientes: item?.resumen?.cantidad_cuentas_pendientes,
        }),
      ];

  const primaryCurrency = item?.resumen?.moneda_principal || currencySummaries[0]?.moneda || "CLP";
  const primarySummary = currencySummaries.find((summary) => summary.moneda === primaryCurrency)
    || currencySummaries[0]
    || normalizeDashboardCurrencySummary({ moneda: primaryCurrency });

  return {
    resumen: {
      monedaPrincipal: primaryCurrency,
      monedas: currencySummaries,
      porMoneda: currencySummaries,
      // Campos legacy: representan la moneda principal, no una suma global mezclada.
      totalIngresosConfirmados: primarySummary.totalIngresosConfirmados,
      totalEgresosConfirmados: primarySummary.totalEgresosConfirmados,
      saldoNeto: primarySummary.saldoNeto,
      totalCuentasPorPagarPendientes: primarySummary.totalCuentasPorPagarPendientes,
      totalVencido: primarySummary.totalVencido,
      cantidadCuentasPendientes: primarySummary.cantidadCuentasPendientes,
    },
    ultimasTransacciones: Array.isArray(item?.ultimas_transacciones)
      ? item.ultimas_transacciones.map(normalizeTransaction)
      : [],
    proximasCuentasPorVencer: Array.isArray(item?.proximas_cuentas_por_vencer)
      ? item.proximas_cuentas_por_vencer.map(normalizePayable)
      : [],
  };
}

async function getPagedResource(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.get(path, { params });
    return normalizePagedResponse(response, normalizer);
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return { items: [], pagination: emptyPagination() };
    }

    throw buildError(error, fallbackMessage);
  }
}

async function getCollectionResource(path, params, normalizer, fallbackMessage) {
  const paged = await getPagedResource(path, params, normalizer, fallbackMessage);
  return paged.items;
}

async function createResource(path, payload, normalizer, fallbackMessage) {
  try {
    const response = await api.post(path, payload);
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

async function updateResource(path, params, payload, normalizer, fallbackMessage) {
  try {
    const response = await api.patch(path, payload, { params });
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

async function deleteResource(path, params, normalizer, fallbackMessage) {
  try {
    const response = await api.delete(path, { params });
    return normalizer(extractData(response) || {});
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

async function postAction(path, payload, params, normalizer, fallbackMessage) {
  try {
    const response = await api.post(path, payload, { params });
    return normalizer ? normalizer(extractData(response) || {}) : extractData(response);
  } catch (error) {
    throw buildError(error, fallbackMessage);
  }
}

export async function getAccountingDashboard(params = {}) {
  try {
    const response = await api.get("/accounting/dashboard", { params });
    return normalizeDashboard(extractData(response) || {});
  } catch (error) {
    throw buildError(error, "No fue posible obtener el resumen contable");
  }
}

export async function getAccountingCategories(params = {}) {
  return getPagedResource(
    "/accounting/categories",
    params,
    normalizeCategory,
    "No fue posible obtener lascategoríascontables",
  );
}

export async function createAccountingCategory(payload) {
  return createResource(
    "/accounting/categories/create",
    payload,
    normalizeCategory,
    "No fue posible crear la categoria contable",
  );
}

export async function updateAccountingCategory(categoryId, payload) {
  return updateResource(
    "/accounting/categories/detail",
    { categoria_transaccion_id: categoryId },
    payload,
    normalizeCategory,
    "No fue posible actualizar la categoria contable",
  );
}

export async function deleteAccountingCategory(categoryId) {
  return deleteResource(
    "/accounting/categories/detail",
    { categoria_transaccion_id: categoryId },
    normalizeCategory,
    "No fue posible desactivar la categoria contable",
  );
}

export async function getAccountingPaymentProviders(params = {}) {
  return getPagedResource(
    "/accounting/payment-providers",
    params,
    normalizePaymentProvider,
    "No fue posible obtener los proveedores de pago",
  );
}

export async function createAccountingPaymentProvider(payload) {
  return createResource(
    "/accounting/payment-providers/create",
    payload,
    normalizePaymentProvider,
    "No fue posible crear el proveedor de pago",
  );
}

export async function updateAccountingPaymentProvider(providerId, payload) {
  return updateResource(
    "/accounting/payment-providers/detail",
    { proveedor_pago_id: providerId },
    payload,
    normalizePaymentProvider,
    "No fue posible actualizar el proveedor de pago",
  );
}

export async function deleteAccountingPaymentProvider(providerId) {
  return deleteResource(
    "/accounting/payment-providers/detail",
    { proveedor_pago_id: providerId },
    normalizePaymentProvider,
    "No fue posible desactivar el proveedor de pago",
  );
}

export async function getAccountingTransactions(params = {}) {
  return getPagedResource(
    "/accounting/transactions",
    params,
    normalizeTransaction,
    "No fue posible obtener las transacciones",
  );
}

export async function createAccountingTransaction(payload) {
  return createResource(
    "/accounting/transactions/create",
    payload,
    normalizeTransaction,
    "No fue posible crear la transaccion",
  );
}

export async function updateAccountingTransaction(transactionId, payload) {
  return updateResource(
    "/accounting/transactions/detail",
    { transaccion_id: transactionId },
    payload,
    normalizeTransaction,
    "No fue posible actualizar la transaccion",
  );
}

export async function cancelAccountingTransaction(transactionId, payload = {}) {
  return postAction(
    "/accounting/transactions/cancel",
    payload,
    { transaccion_id: transactionId },
    normalizeTransaction,
    "No fue posible anular la transaccion",
  );
}

export async function getAccountingPayables(params = {}) {
  return getPagedResource(
    "/accounting/payables",
    params,
    normalizePayable,
    "No fue posible obtener las cuentas por pagar",
  );
}

export async function createAccountingPayable(payload) {
  return createResource(
    "/accounting/payables/create",
    payload,
    normalizePayable,
    "No fue posible crear la cuenta por pagar",
  );
}

export async function updateAccountingPayable(payableId, payload) {
  return updateResource(
    "/accounting/payables/detail",
    { cuenta_por_pagar_id: payableId },
    payload,
    normalizePayable,
    "No fue posible actualizar la cuenta por pagar",
  );
}

export async function createAccountingPayablePayment(payableId, payload) {
  return postAction(
    `/accounting/payables/${payableId}/payments`,
    payload,
    undefined,
    normalizePayablePayment,
    "No fue posible registrar el pago",
  );
}

export async function cancelAccountingPayable(payableId, payload) {
  return postAction(
    "/accounting/payables/cancel",
    payload,
    { cuenta_por_pagar_id: payableId },
    normalizePayable,
    "No fue posible cerrar la cuenta por pagar",
  );
}

export async function getAccountingPaymentOrders(params = {}) {
  return getPagedResource(
    "/accounting/payment-orders",
    params,
    normalizePaymentOrder,
    "No fue posible obtener las ordenes de pago",
  );
}

export async function getAccountingDonations(params = {}) {
  try {
    const response = await api.get("/accounting/donations", { params });
    const data = extractData(response);
    const items = Array.isArray(data?.items) ? data.items.map(normalizeAccountingDonation) : [];

    return {
      items,
      pagination: {
        ...emptyPagination(),
        ...(data?.pagination || {}),
      },
      summary: {
        byCurrency: Array.isArray(data?.summary?.by_currency)
          ? data.summary.by_currency.map(normalizeAccountingDonationSummary)
          : [],
      },
    };
  } catch (error) {
    if (error?.response?.status === 404 || error?.response?.status === 204) {
      return {
        items: [],
        pagination: emptyPagination(),
        summary: { byCurrency: [] },
      };
    }

    throw buildError(error, "No fue posible obtener las donaciones monetarias");
  }
}

export async function createAccountingDonationRefund(paymentOrderId, payload) {
  try {
    const response = await api.post(`/accounting/donations/${paymentOrderId}/refunds`, payload);
    return extractData(response);
  } catch (error) {
    throw buildError(error, "No fue posible crear el refund PayPal");
  }
}

export async function getAccountingWebhooks(params = {}) {
  return getPagedResource(
    "/accounting/webhooks",
    params,
    normalizeWebhookLog,
    "No fue posible obtener los webhooks tecnicos",
  );
}

export async function getAccountingReferenceData() {
  const [categories, paymentProviders] = await Promise.all([
    getCollectionResource(
      "/accounting/categories",
      { limit: 100, page: 1, activo: true },
      normalizeCategory,
      "No fue posible obtener lascategoríascontables",
    ),
    getCollectionResource(
      "/accounting/payment-providers",
      { limit: 100, page: 1, activo: true },
      normalizePaymentProvider,
      "No fue posible obtener los proveedores de pago",
    ),
  ]);

  return {
    categories,
    paymentProviders,
  };
}

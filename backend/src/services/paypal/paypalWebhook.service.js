"use strict";

import { PAYPAL_WEBHOOK_ID } from "../../config/configEnv.js";
import {
  AppDataSource,
  WebhookLog,
  getPaymentProviderByKeyOrThrow,
  isUniqueConstraintError,
  normalizeNullableString,
} from "../financialConcept/accounting.shared.js";
import {
  getPayPalCapture,
  getPayPalRefund,
  PayPalApiError,
  verifyPayPalWebhookSignatureLocal,
} from "./paypal.service.js";
import {
  markPayPalDonationCaptureFailed,
  markPayPalDonationCapturePending,
  markPayPalDonationOrderApproved,
  reconcilePayPalDonationCapture,
  reconcilePayPalDonationRefund,
  reconcilePayPalDonationReversal,
} from "./paypalDonation.service.js";
import {
  reconcileSubscriptionPaymentFailedWebhook,
  reconcileSubscriptionSaleCompletedWebhook,
  reconcileSubscriptionSaleRefundedWebhook,
  reconcileSubscriptionSaleReversedWebhook,
  reconcileSubscriptionStateWebhook,
} from "../financialConcept/sponsorshipSubscription.service.js";

const PAYPAL_PROVIDER_KEY = "PAYPAL";
const WEBHOOK_EVENT_STATE = {
  RECEIVED: "RECIBIDO",
  VERIFIED: "VERIFICADO",
  PROCESSED: "PROCESADO",
  IGNORED: "IGNORADO",
  ERROR: "ERROR",
};
const WEBHOOK_FINAL_SUCCESS_STATES = new Set([
  WEBHOOK_EVENT_STATE.PROCESSED,
  WEBHOOK_EVENT_STATE.IGNORED,
]);

function buildWebhookServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function normalizeServiceError(error, fallbackMessage) {
  if (error?.message && error?.statusCode) {
    return error;
  }

  if (error instanceof PayPalApiError) {
    return buildWebhookServiceError(
      error.message || fallbackMessage,
      Number(error.statusCode) >= 500 ? Number(error.statusCode) : 502,
    );
  }

  return buildWebhookServiceError(error?.message || fallbackMessage, 500);
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (value === undefined || value === null) return null;
  return String(value);
}

function normalizeIncomingHeaders(headers) {
  return Object.entries(headers || {}).reduce((normalized, [key, value]) => {
    normalized[String(key).toLowerCase()] = normalizeHeaderValue(value);
    return normalized;
  }, {});
}

function buildStoredHeaders(headers) {
  const persistedHeaders = { ...(headers || {}) };

  if (persistedHeaders.authorization) {
    persistedHeaders.authorization = "[REDACTED]";
  }

  if (persistedHeaders["proxy-authorization"]) {
    persistedHeaders["proxy-authorization"] = "[REDACTED]";
  }

  return persistedHeaders;
}

function sanitizeErrorMessage(error) {
  return normalizeNullableString(error?.message) || "Error interno procesando webhook PayPal.";
}

function validateWebhookEventShape(webhookEvent) {
  if (!webhookEvent || typeof webhookEvent !== "object" || Array.isArray(webhookEvent)) {
    throw buildWebhookServiceError("El payload del webhook PayPal debe ser un objeto JSON valido.", 400);
  }

  const eventId = normalizeNullableString(webhookEvent.id);
  const eventType = normalizeNullableString(webhookEvent.event_type);

  if (!eventId) {
    throw buildWebhookServiceError("El webhook PayPal debe incluir event.id.", 400);
  }

  if (!eventType) {
    throw buildWebhookServiceError("El webhook PayPal debe incluir event.event_type.", 400);
  }

  return {
    eventId,
    eventType,
  };
}

function extractOrderIdFromWebhookEvent(webhookEvent) {
  const directCandidates = [
    webhookEvent?.resource?.supplementary_data?.related_ids?.order_id,
    webhookEvent?.supplementary_data?.related_ids?.order_id,
    webhookEvent?.resource?.related_ids?.order_id,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeNullableString(candidate);
    if (normalized) return normalized;
  }

  const upLink = Array.isArray(webhookEvent?.resource?.links)
    ? webhookEvent.resource.links.find((link) => String(link?.rel || "").toLowerCase() === "up")
    : null;
  const upHref = normalizeNullableString(upLink?.href);

  if (upHref) {
    const match = upHref.match(/\/v2\/checkout\/orders\/([^/?]+)/i);
    if (match?.[1]) {
      return normalizeNullableString(match[1]);
    }
  }

  return null;
}

function extractCaptureIdFromWebhookEvent(webhookEvent) {
  return normalizeNullableString(webhookEvent?.resource?.id);
}

function extractRefundIdFromWebhookEvent(webhookEvent) {
  return normalizeNullableString(webhookEvent?.resource?.id);
}

async function getPayPalPaymentProvider() {
  return getPaymentProviderByKeyOrThrow(AppDataSource.manager, PAYPAL_PROVIDER_KEY, {
    onlyActive: true,
  });
}

async function getWebhookLogByProviderEventId(executor, { providerId, eventId }) {
  return executor.getRepository(WebhookLog).findOne({
    where: {
      payment_provider: { proveedor_pago_id: Number(providerId) },
      proveedor_evento_id: eventId,
    },
    relations: {
      payment_provider: true,
    },
  });
}

function buildPublicWebhookResponse({
  eventId,
  eventType,
  processed,
  idempotent,
  ignored = false,
}) {
  return {
    received: true,
    event_id: eventId,
    event_type: eventType,
    processed,
    idempotent,
    ignored,
  };
}

async function finalizeWebhookLog({
  webhookLogId,
  estado,
  errorMensaje = null,
  referenciaTipo = null,
  referenciaId = null,
}) {
  return AppDataSource.transaction(async (manager) => {
    const repository = manager.getRepository(WebhookLog);
    const log = await repository.findOne({
      where: { webhook_log_id: Number(webhookLogId) },
      relations: {
        payment_provider: true,
      },
    });

    if (!log) return null;

    if (WEBHOOK_FINAL_SUCCESS_STATES.has(log.estado) && estado === WEBHOOK_EVENT_STATE.ERROR) {
      return log;
    }

    log.estado = estado;
    log.error_mensaje = normalizeNullableString(errorMensaje);
    log.referencia_tipo = normalizeNullableString(referenciaTipo);
    log.referencia_id = referenciaId ? Number(referenciaId) : null;
    log.procesado_en = estado === WEBHOOK_EVENT_STATE.VERIFIED ? null : new Date();

    await repository.save(log);
    return log;
  });
}

async function recordRejectedWebhookAttempt({
  paymentProvider,
  webhookEvent,
  rawHeaders,
  errorMessage,
}) {
  const eventId = normalizeNullableString(webhookEvent?.id);
  const eventType = normalizeNullableString(webhookEvent?.event_type) || "DESCONOCIDO";

  if (!eventId) return null;

  const existingLog = await getWebhookLogByProviderEventId(AppDataSource.manager, {
    providerId: paymentProvider.proveedor_pago_id,
    eventId,
  });

  if (existingLog) {
    return AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const currentLog = await repository.findOne({
        where: { webhook_log_id: Number(existingLog.webhook_log_id) },
        relations: {
          payment_provider: true,
        },
      });

      if (!currentLog) return null;

      currentLog.payload = webhookEvent;
      currentLog.headers = rawHeaders;
      currentLog.firma_verificada = false;
      currentLog.estado = WEBHOOK_EVENT_STATE.ERROR;
      currentLog.intentos = Number(currentLog.intentos || 0) + 1;
      currentLog.error_mensaje = normalizeNullableString(errorMessage);
      currentLog.procesado_en = new Date();

      return repository.save(currentLog);
    });
  }

  try {
    return await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const createdLog = repository.create({
        payment_provider: {
          proveedor_pago_id: Number(paymentProvider.proveedor_pago_id),
        },
        evento_tipo: eventType,
        proveedor_evento_id: eventId,
        payload: webhookEvent,
        headers: rawHeaders,
        firma_verificada: false,
        estado: WEBHOOK_EVENT_STATE.ERROR,
        recibido_en: new Date(),
        procesado_en: new Date(),
        intentos: 1,
        error_mensaje: normalizeNullableString(errorMessage),
      });

      return repository.save(createdLog);
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    return getWebhookLogByProviderEventId(AppDataSource.manager, {
      providerId: paymentProvider.proveedor_pago_id,
      eventId,
    });
  }
}

async function reserveVerifiedWebhookLog({
  paymentProvider,
  webhookEvent,
  rawHeaders,
}) {
  const eventId = normalizeNullableString(webhookEvent.id);
  const eventType = normalizeNullableString(webhookEvent.event_type);
  const providerId = Number(paymentProvider.proveedor_pago_id);

  const existingLog = await getWebhookLogByProviderEventId(AppDataSource.manager, {
    providerId,
    eventId,
  });

  if (existingLog?.estado === WEBHOOK_EVENT_STATE.PROCESSED) {
    return { log: existingLog, outcome: "already_processed" };
  }

  if (existingLog?.estado === WEBHOOK_EVENT_STATE.IGNORED) {
    return { log: existingLog, outcome: "already_ignored" };
  }

  if (existingLog) {
    const touchedLog = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const currentLog = await repository.findOne({
        where: { webhook_log_id: Number(existingLog.webhook_log_id) },
        relations: {
          payment_provider: true,
        },
      });

      if (!currentLog) {
        throw new Error("Webhook log no encontrado durante la reserva.");
      }

      if (currentLog.estado === WEBHOOK_EVENT_STATE.PROCESSED) {
        return currentLog;
      }

      if (currentLog.estado === WEBHOOK_EVENT_STATE.IGNORED) {
        return currentLog;
      }

      currentLog.payload = webhookEvent;
      currentLog.headers = rawHeaders;
      currentLog.firma_verificada = true;
      currentLog.estado = WEBHOOK_EVENT_STATE.VERIFIED;
      currentLog.intentos = Number(currentLog.intentos || 0) + 1;
      currentLog.error_mensaje = null;
      currentLog.procesado_en = null;

      await repository.save(currentLog);
      return currentLog;
    });

    if (touchedLog.estado === WEBHOOK_EVENT_STATE.PROCESSED) {
      return { log: touchedLog, outcome: "already_processed" };
    }

    if (touchedLog.estado === WEBHOOK_EVENT_STATE.IGNORED) {
      return { log: touchedLog, outcome: "already_ignored" };
    }

    return { log: touchedLog, outcome: "reserved" };
  }

  try {
    const newLog = await AppDataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WebhookLog);
      const createdLog = repository.create({
        payment_provider: {
          proveedor_pago_id: providerId,
        },
        evento_tipo: eventType,
        proveedor_evento_id: eventId,
        payload: webhookEvent,
        headers: rawHeaders,
        firma_verificada: true,
        estado: WEBHOOK_EVENT_STATE.VERIFIED,
        recibido_en: new Date(),
        procesado_en: null,
        intentos: 1,
        error_mensaje: null,
      });

      return repository.save(createdLog);
    });

    return { log: newLog, outcome: "reserved" };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const recoveredLog = await getWebhookLogByProviderEventId(AppDataSource.manager, {
      providerId,
      eventId,
    });

    if (!recoveredLog) {
      throw buildWebhookServiceError(
        "Ocurrio una carrera de idempotencia en WebhookLog y no fue posible recuperar el evento.",
        409,
      );
    }

    if (recoveredLog.estado === WEBHOOK_EVENT_STATE.PROCESSED) {
      return { log: recoveredLog, outcome: "already_processed" };
    }

    if (recoveredLog.estado === WEBHOOK_EVENT_STATE.IGNORED) {
      return { log: recoveredLog, outcome: "already_ignored" };
    }

    return { log: recoveredLog, outcome: "reserved" };
  }
}

async function markWebhookAsErrorIfPossible(webhookLogId, error) {
  if (!webhookLogId) return;

  try {
    await finalizeWebhookLog({
      webhookLogId,
      estado: WEBHOOK_EVENT_STATE.ERROR,
      errorMensaje: sanitizeErrorMessage(error),
    });
  } catch {
    // Evita ocultar el error principal por un fallo secundario de auditoria.
  }
}

async function processCompletedWebhook({
  webhookEvent,
  webhookLog,
}) {
  const paypalCaptureId = extractCaptureIdFromWebhookEvent(webhookEvent);

  if (!paypalCaptureId) {
    throw buildWebhookServiceError(
      "No fue posible resolver capture.id para PAYMENT.CAPTURE.COMPLETED.",
      400,
    );
  }

  const canonicalCapture = await getPayPalCapture(paypalCaptureId);
  const reconcileResult = await reconcilePayPalDonationCapture({
    paypalOrderId: extractOrderIdFromWebhookEvent(webhookEvent),
    capture: canonicalCapture,
    payer: webhookEvent?.resource?.payer ? {
      nombre: webhookEvent.resource.payer?.name?.given_name || null,
      apellido: webhookEvent.resource.payer?.name?.surname || null,
      email: webhookEvent.resource.payer?.email_address || null,
    } : null,
    payerSource: "VERIFIED_CAPTURE_COMPLETED",
    source: "webhook:PAYMENT.CAPTURE.COMPLETED",
  });

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: "TRANSACTION",
    referenciaId: reconcileResult?.transaccion?.transaccion_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: Boolean(reconcileResult?.idempotente),
    ignored: false,
  });
}

async function processDeniedWebhook({
  webhookEvent,
  webhookLog,
  source,
}) {
  const paypalOrderId = extractOrderIdFromWebhookEvent(webhookEvent);
  const captureId = extractCaptureIdFromWebhookEvent(webhookEvent);
  const paymentOrder = paypalOrderId
    ? await markPayPalDonationCaptureFailed({
        paypalOrderId,
        captureId,
        eventType: webhookEvent.event_type,
        source,
        status: webhookEvent?.resource?.status || webhookEvent.event_type,
      })
    : null;

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: paymentOrder ? "PAYMENT_ORDER" : null,
    referenciaId: paymentOrder?.orden_pago_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processApprovedWebhook({
  webhookEvent,
  webhookLog,
}) {
  const paypalOrderId = extractOrderIdFromWebhookEvent(webhookEvent);
  const paymentOrder = paypalOrderId
    ? await markPayPalDonationOrderApproved({
        paypalOrderId,
        payer: webhookEvent?.resource?.payer || null,
        source: "webhook:CHECKOUT.ORDER.APPROVED",
      })
    : null;

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: paymentOrder ? "PAYMENT_ORDER" : null,
    referenciaId: paymentOrder?.orden_pago_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processPendingWebhook({
  webhookEvent,
  webhookLog,
}) {
  const paypalOrderId = extractOrderIdFromWebhookEvent(webhookEvent);
  const captureId = extractCaptureIdFromWebhookEvent(webhookEvent);
  const paymentOrder = paypalOrderId
    ? await markPayPalDonationCapturePending({
        paypalOrderId,
        captureId,
        eventType: webhookEvent.event_type,
        source: "webhook:PAYMENT.CAPTURE.PENDING",
        status: normalizeNullableString(webhookEvent?.resource?.status) || "PENDING",
      })
    : null;

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: paymentOrder ? "PAYMENT_ORDER" : null,
    referenciaId: paymentOrder?.orden_pago_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processRefundedWebhook({
  webhookEvent,
  webhookLog,
}) {
  const paypalRefundId = extractRefundIdFromWebhookEvent(webhookEvent);

  if (!paypalRefundId) {
    throw buildWebhookServiceError(
      "No fue posible resolver refund.id para PAYMENT.CAPTURE.REFUNDED.",
      400,
    );
  }

  const canonicalRefund = await getPayPalRefund(paypalRefundId);
  const reconcileResult = await reconcilePayPalDonationRefund({
    refund: canonicalRefund,
    source: "webhook:PAYMENT.CAPTURE.REFUNDED",
    webhookEventId: normalizeNullableString(webhookEvent.id),
    signedWebhookRefundResource: webhookEvent?.resource || null,
    signedWebhookEventType: normalizeNullableString(webhookEvent?.event_type),
  });

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: "TRANSACTION",
    referenciaId: reconcileResult?.transaccion?.transaccion_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: Boolean(reconcileResult?.idempotente),
    ignored: false,
  });
}

async function processReversedWebhook({
  webhookEvent,
  webhookLog,
}) {
  const paypalCaptureId = extractCaptureIdFromWebhookEvent(webhookEvent);

  if (!paypalCaptureId) {
    throw buildWebhookServiceError(
      "No fue posible resolver capture.id para PAYMENT.CAPTURE.REVERSED.",
      400,
    );
  }

  const canonicalCapture = await getPayPalCapture(paypalCaptureId);
  const reconcileResult = await reconcilePayPalDonationReversal({
    webhookEvent,
    canonicalCapture,
    source: "webhook:PAYMENT.CAPTURE.REVERSED",
  });

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: "TRANSACTION",
    referenciaId: reconcileResult?.transaccion?.transaccion_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: Boolean(reconcileResult?.idempotente),
    ignored: false,
  });
}

async function processSubscriptionStateRecurringWebhook({
  webhookEvent,
  webhookLog,
}) {
  const subscription = await reconcileSubscriptionStateWebhook(webhookEvent);

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: "SUBSCRIPTION",
    referenciaId: subscription?.subscription_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processSubscriptionSaleCompletedRecurringWebhook({
  webhookEvent,
  webhookLog,
}) {
  const result = await reconcileSubscriptionSaleCompletedWebhook(webhookEvent);
  const firstPayment = Array.isArray(result?.payments) ? result.payments[0] : null;

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: firstPayment?.transaction_id ? "TRANSACTION" : "SUBSCRIPTION",
    referenciaId: firstPayment?.transaction_id || result?.subscription?.subscription_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processSubscriptionPaymentFailedRecurringWebhook({
  webhookEvent,
  webhookLog,
}) {
  const subscription = await reconcileSubscriptionPaymentFailedWebhook(webhookEvent);

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: "SUBSCRIPTION",
    referenciaId: subscription?.subscription_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processSubscriptionSaleRefundedRecurringWebhook({
  webhookEvent,
  webhookLog,
}) {
  const result = await reconcileSubscriptionSaleRefundedWebhook(webhookEvent);

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: result?.transaction?.transaccion_id ? "TRANSACTION" : "SUBSCRIPTION_PAYMENT",
    referenciaId: result?.transaction?.transaccion_id || result?.payment?.subscription_payment_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processSubscriptionSaleReversedRecurringWebhook({
  webhookEvent,
  webhookLog,
}) {
  const result = await reconcileSubscriptionSaleReversedWebhook(webhookEvent);

  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.PROCESSED,
    referenciaTipo: result?.transaction?.transaccion_id ? "TRANSACTION" : "SUBSCRIPTION_PAYMENT",
    referenciaId: result?.transaction?.transaccion_id || result?.payment?.subscription_payment_id || null,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: false,
  });
}

async function processIgnoredWebhook({
  webhookEvent,
  webhookLog,
  reason,
}) {
  await finalizeWebhookLog({
    webhookLogId: webhookLog.webhook_log_id,
    estado: WEBHOOK_EVENT_STATE.IGNORED,
    errorMensaje: reason,
  });

  return buildPublicWebhookResponse({
    eventId: webhookEvent.id,
    eventType: webhookEvent.event_type,
    processed: true,
    idempotent: false,
    ignored: true,
  });
}

export async function processPayPalWebhookService({
  headers,
  rawBody,
  webhookEvent,
}) {
  try {
    const normalizedHeaders = normalizeIncomingHeaders(headers);
    const storedHeaders = buildStoredHeaders(normalizedHeaders);
    const paymentProvider = await getPayPalPaymentProvider();

    let isSignatureValid;
    try {
      isSignatureValid = await verifyPayPalWebhookSignatureLocal({
        rawBody,
        headers: normalizedHeaders,
        webhookId: PAYPAL_WEBHOOK_ID,
      });
    } catch (error) {
      if (error?.statusCode && error.statusCode < 500) {
        await recordRejectedWebhookAttempt({
          paymentProvider,
          webhookEvent,
          rawHeaders: storedHeaders,
          errorMessage: sanitizeErrorMessage(error),
        });
      }

      throw error;
    }

    if (!isSignatureValid) {
      await recordRejectedWebhookAttempt({
        paymentProvider,
        webhookEvent,
        rawHeaders: storedHeaders,
        errorMessage: "La firma del webhook PayPal no fue validada por PayPal.",
      });

      return [null, buildWebhookServiceError("Firma de webhook PayPal invalida.", 401)];
    }

    const { eventId, eventType } = validateWebhookEventShape(webhookEvent);

    const reservation = await reserveVerifiedWebhookLog({
      paymentProvider,
      webhookEvent,
      rawHeaders: storedHeaders,
    });

    if (reservation.outcome === "already_processed") {
      return [buildPublicWebhookResponse({
        eventId,
        eventType,
        processed: true,
        idempotent: true,
        ignored: false,
      }), null];
    }

    if (reservation.outcome === "already_ignored") {
      return [buildPublicWebhookResponse({
        eventId,
        eventType,
        processed: true,
        idempotent: true,
        ignored: true,
      }), null];
    }

    const webhookLog = reservation.log;

    try {
      switch (eventType) {
        case "BILLING.SUBSCRIPTION.CREATED":
        case "BILLING.SUBSCRIPTION.ACTIVATED":
        case "BILLING.SUBSCRIPTION.UPDATED":
        case "BILLING.SUBSCRIPTION.SUSPENDED":
        case "BILLING.SUBSCRIPTION.CANCELLED":
        case "BILLING.SUBSCRIPTION.EXPIRED":
          return [await processSubscriptionStateRecurringWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
          return [await processSubscriptionPaymentFailedRecurringWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.SALE.COMPLETED":
          return [await processSubscriptionSaleCompletedRecurringWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.SALE.REFUNDED":
          return [await processSubscriptionSaleRefundedRecurringWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.SALE.REVERSED":
          return [await processSubscriptionSaleReversedRecurringWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.CAPTURE.COMPLETED":
          return [await processCompletedWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.CAPTURE.DENIED":
        case "PAYMENT.CAPTURE.DECLINED":
          return [await processDeniedWebhook({
            webhookEvent,
            webhookLog,
            source: `webhook:${eventType}`,
          }), null];
        case "CHECKOUT.ORDER.APPROVED":
          return [await processApprovedWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.CAPTURE.PENDING":
          return [await processPendingWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.CAPTURE.REFUNDED":
          return [await processRefundedWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        case "PAYMENT.CAPTURE.REVERSED":
          return [await processReversedWebhook({
            webhookEvent,
            webhookLog,
          }), null];
        default:
          return [await processIgnoredWebhook({
            webhookEvent,
            webhookLog,
            reason: `Evento ${eventType} recibido y no soportado en Fase 6.3.`,
          }), null];
      }
    } catch (error) {
      await markWebhookAsErrorIfPossible(webhookLog?.webhook_log_id, error);
      return [null, normalizeServiceError(error, "No fue posible procesar el webhook PayPal.")];
    }
  } catch (error) {
    return [null, normalizeServiceError(error, "No fue posible procesar el webhook PayPal.")];
  }
}

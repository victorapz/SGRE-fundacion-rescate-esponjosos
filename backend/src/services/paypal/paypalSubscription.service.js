"use strict";

import { createHash } from "crypto";
import {
  PAYPAL_MODE,
  PAYPAL_REQUEST_TIMEOUT_MS,
  PAYPAL_SUBSCRIPTION_BRAND_NAME,
  PAYPAL_SUBSCRIPTION_CANCEL_URL,
  PAYPAL_SUBSCRIPTION_RETURN_URL,
} from "../../config/configEnv.js";
import {
  PayPalApiError,
  getPayPalAccessToken,
  paypalRequest,
} from "./paypal.service.js";

const PAYPAL_SUBSCRIPTION_APPROVAL_HOSTS = {
  sandbox: new Set([
    "www.sandbox.paypal.com",
    "sandbox.paypal.com",
    "paypal.com",
    "www.paypal.com",
  ]),
  live: new Set([
    "www.paypal.com",
    "paypal.com",
  ]),
};

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function sanitizePayPalLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "paypal";
}

export function buildDeterministicPayPalRequestId(namespace, ...parts) {
  const digest = createHash("sha256")
    .update([namespace, ...parts.map((item) => String(item ?? ""))].join("|"))
    .digest("hex")
    .slice(0, 32);

  return `${sanitizePayPalLabel(namespace)}-${digest}`;
}

function sanitizePayPalString(value, fallback, maxLength = 127) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  return (normalized || fallback).slice(0, maxLength);
}

export function buildPayPalSubscriptionContextUrls({
  publicReference,
  animalId = null,
  returnUrl = PAYPAL_SUBSCRIPTION_RETURN_URL,
  cancelUrl = PAYPAL_SUBSCRIPTION_CANCEL_URL,
} = {}) {
  const normalizedReference = String(publicReference || "").trim();
  if (!normalizedReference) {
    throw buildServiceError("No fue posible construir las URLs de retorno de PayPal.", 500);
  }

  const resolvedReturnUrl = new URL(returnUrl);
  const resolvedCancelUrl = new URL(cancelUrl);

  resolvedReturnUrl.searchParams.set("ref", normalizedReference);
  resolvedCancelUrl.searchParams.set("ref", normalizedReference);

  const normalizedAnimalId = Number(animalId);
  if (Number.isInteger(normalizedAnimalId) && normalizedAnimalId > 0) {
    resolvedCancelUrl.searchParams.set("animal_id", String(normalizedAnimalId));
  }

  return {
    returnUrl: resolvedReturnUrl.toString(),
    cancelUrl: resolvedCancelUrl.toString(),
  };
}

function getAllowedApprovalHosts() {
  return PAYPAL_MODE === "live"
    ? PAYPAL_SUBSCRIPTION_APPROVAL_HOSTS.live
    : PAYPAL_SUBSCRIPTION_APPROVAL_HOSTS.sandbox;
}

export function assertSafePayPalApprovalUrl(approvalUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(String(approvalUrl || "").trim());
  } catch {
    throw buildServiceError("PayPal no devolvio una approval_url valida.", 502);
  }

  if (parsedUrl.protocol !== "https:") {
    throw buildServiceError("PayPal no devolvio una approval_url segura.", 502);
  }

  if (!getAllowedApprovalHosts().has(parsedUrl.hostname)) {
    throw buildServiceError("PayPal no devolvio una approval_url permitida.", 502);
  }

  return parsedUrl.toString();
}

export function extractPayPalSubscriptionApprovalUrl(subscriptionPayload) {
  if (!Array.isArray(subscriptionPayload?.links)) {
    throw buildServiceError("PayPal no devolvio enlaces de suscripcion.", 502);
  }

  const approvalLink = subscriptionPayload.links.find((link) =>
    String(link?.rel || "").toLowerCase() === "approve");

  if (!approvalLink?.href) {
    throw buildServiceError("PayPal no devolvio el enlace de aprobacion de la suscripcion.", 502);
  }

  return assertSafePayPalApprovalUrl(approvalLink.href);
}

async function executePayPalSubscriptionRequest(path, {
  method = "GET",
  body,
  requestId = null,
  fetchImpl,
  timeoutMs = PAYPAL_REQUEST_TIMEOUT_MS,
} = {}) {
  const accessToken = await getPayPalAccessToken();

  return paypalRequest(path, {
    method,
    accessToken,
    body,
    fetchImpl,
    timeoutMs,
    headers: {
      Prefer: "return=representation",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
  });
}

export async function createCatalogProduct({
  localPlanId,
  planName,
  description = null,
  requestId = null,
  fetchImpl,
} = {}) {
  return executePayPalSubscriptionRequest("/v1/catalogs/products", {
    method: "POST",
    fetchImpl,
    requestId: requestId || buildDeterministicPayPalRequestId(
      "paypal-subscription-product",
      localPlanId,
      planName,
    ),
    body: {
      name: sanitizePayPalString(planName, `Plan ${localPlanId}`, 127),
      description: sanitizePayPalString(description, `Plan ${localPlanId}`, 256),
      type: "SERVICE",
      category: "SOFTWARE",
    },
  });
}

export async function createBillingPlan({
  localPlanId,
  paypalProductId,
  planName,
  description = null,
  amount,
  currencyCode = "USD",
  requestId = null,
  fetchImpl,
} = {}) {
  return executePayPalSubscriptionRequest("/v1/billing/plans", {
    method: "POST",
    fetchImpl,
    requestId: requestId || buildDeterministicPayPalRequestId(
      "paypal-subscription-plan",
      localPlanId,
      paypalProductId,
      amount,
      currencyCode,
    ),
    body: {
      product_id: paypalProductId,
      name: sanitizePayPalString(planName, `Plan ${localPlanId}`, 127),
      description: sanitizePayPalString(description, `Plan ${localPlanId}`, 256),
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              currency_code: currencyCode,
              value: Number(amount).toFixed(2),
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    },
  });
}

export async function getBillingPlan(paypalPlanId, { fetchImpl } = {}) {
  return executePayPalSubscriptionRequest(`/v1/billing/plans/${paypalPlanId}`, {
    method: "GET",
    fetchImpl,
  });
}

export async function createSubscription({
  paypalPlanId,
  publicReference,
  animalId = null,
  sponsor,
  requestId,
  customId = null,
  fetchImpl,
} = {}) {
  const contextUrls = buildPayPalSubscriptionContextUrls({
    publicReference,
    animalId,
  });
  const payload = await executePayPalSubscriptionRequest("/v1/billing/subscriptions", {
    method: "POST",
    fetchImpl,
    requestId,
    body: {
      plan_id: paypalPlanId,
      custom_id: customId || publicReference,
      subscriber: {
        name: {
          given_name: sanitizePayPalString(sponsor?.nombre, "Sponsor", 140),
          surname: sanitizePayPalString(sponsor?.apellido, "Sponsor", 140),
        },
        email_address: sponsor?.email,
      },
      application_context: {
        brand_name: sanitizePayPalString(
          PAYPAL_SUBSCRIPTION_BRAND_NAME,
          "Fundacion Rescate Esponjosos",
          127,
        ),
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: contextUrls.returnUrl,
        cancel_url: contextUrls.cancelUrl,
      },
    },
  });

  return {
    payload,
    approvalUrl: extractPayPalSubscriptionApprovalUrl(payload),
  };
}

export async function getSubscription(paypalSubscriptionId, { fetchImpl } = {}) {
  return executePayPalSubscriptionRequest(`/v1/billing/subscriptions/${paypalSubscriptionId}`, {
    method: "GET",
    fetchImpl,
  });
}

export async function cancelSubscription(paypalSubscriptionId, {
  reason,
  requestId = null,
  fetchImpl,
} = {}) {
  try {
    return await executePayPalSubscriptionRequest(
      `/v1/billing/subscriptions/${paypalSubscriptionId}/cancel`,
      {
        method: "POST",
        fetchImpl,
        requestId: requestId || buildDeterministicPayPalRequestId(
          "paypal-subscription-cancel",
          paypalSubscriptionId,
          reason,
        ),
        body: {
          reason: sanitizePayPalString(reason, "Cancelacion solicitada", 128),
        },
      },
    );
  } catch (error) {
    if (error instanceof PayPalApiError && error.statusCode === 204) {
      return null;
    }
    throw error;
  }
}

function buildTransactionsPath(paypalSubscriptionId, startTime, endTime) {
  const searchParams = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
  });

  return `/v1/billing/subscriptions/${paypalSubscriptionId}/transactions?${searchParams.toString()}`;
}

export async function listSubscriptionTransactions(paypalSubscriptionId, {
  startTime,
  endTime,
  fetchImpl,
} = {}) {
  return executePayPalSubscriptionRequest(
    buildTransactionsPath(paypalSubscriptionId, startTime, endTime),
    {
      method: "GET",
      fetchImpl,
    },
  );
}

export function splitPayPalTransactionWindows(startDate, endDate, maxWindowDays = 30) {
  const windows = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return windows;
  }

  const maxWindowMs = maxWindowDays * 24 * 60 * 60 * 1000;
  let cursor = start.getTime();

  while (cursor <= end.getTime()) {
    const currentEnd = Math.min(cursor + maxWindowMs - 1000, end.getTime());
    windows.push({
      startTime: new Date(cursor).toISOString(),
      endTime: new Date(currentEnd).toISOString(),
    });
    cursor = currentEnd + 1000;
  }

  return windows;
}

export async function listAllSubscriptionTransactions(paypalSubscriptionId, {
  startDate,
  endDate,
  fetchImpl,
} = {}) {
  const windows = splitPayPalTransactionWindows(startDate, endDate);
  const allTransactions = [];

  for (const window of windows) {
    const payload = await listSubscriptionTransactions(paypalSubscriptionId, {
      startTime: window.startTime,
      endTime: window.endTime,
      fetchImpl,
    });

    for (const transaction of payload?.transactions || []) {
      allTransactions.push(transaction);
    }
  }

  return allTransactions;
}

"use strict";

import { X509Certificate, verify } from "crypto";
import {
  PAYPAL_BASE_URL,
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_REQUEST_TIMEOUT_MS,
} from "../../config/configEnv.js";

const PAYPAL_WEBHOOK_ALLOWED_CERT_HOSTS = new Set([
  "api.sandbox.paypal.com",
  "api.paypal.com",
]);
const PAYPAL_WEBHOOK_CERT_PATH_PREFIX = "/v1/notifications/certs/";
const PAYPAL_WEBHOOK_CERT_CACHE_DEFAULT_TTL_MS = 60 * 60 * 1000;
const PAYPAL_WEBHOOK_CERT_CACHE_MAX_TTL_MS = 6 * 60 * 60 * 1000;
const PAYPAL_WEBHOOK_CERT_CACHE_MAX_ENTRIES = 10;
const PAYPAL_WEBHOOK_CERT_DOWNLOAD_TIMEOUT_MS = 5000;
const PAYPAL_WEBHOOK_CERT_MAX_BYTES = 64 * 1024;
const PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS = 30 * 1000;
const PAYPAL_WEBHOOK_VERIFY_ALGORITHMS = new Map([
  ["SHA256WITHRSA", "RSA-SHA256"],
]);
const PAYPAL_WEBHOOK_CRC32_TABLE = buildCrc32Table();
const payPalWebhookCertificateCache = new Map();

export class PayPalApiError extends Error {
  constructor(message, { statusCode = 500, code = null, details = null } = {}) {
    super(message);
    this.name = "PayPalApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function assertPayPalConfig() {
  if (!PAYPAL_BASE_URL || !PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "Falta configurar PAYPAL_BASE_URL, PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET.",
    );
  }
}

function buildBasicAuthHeader() {
  return Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
}

function normalizeNonEmptyString(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function buildWebhookVerificationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1
        ? (0xedb88320 ^ (crc >>> 1))
        : (crc >>> 1);
    }

    return crc >>> 0;
  });
}

function normalizeWebhookHeaders(headers) {
  return Object.entries(headers || {}).reduce((normalized, [key, value]) => {
    normalized[String(key).toLowerCase()] = Array.isArray(value)
      ? value.map((item) => String(item)).join(", ")
      : value;
    return normalized;
  }, {});
}

function getWebhookHeader(headers, headerName) {
  return normalizeNonEmptyString(headers?.[String(headerName).toLowerCase()]);
}

function assertWebhookSignatureBase64(value) {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    throw buildWebhookVerificationError(
      "Falta el encabezado paypal-transmission-sig del webhook PayPal.",
      400,
    );
  }

  const compact = normalized.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw buildWebhookVerificationError("paypal-transmission-sig no es base64 valido.", 400);
  }

  return compact;
}

function clampCertificateCacheTtlMs(ttlMs) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    return PAYPAL_WEBHOOK_CERT_CACHE_DEFAULT_TTL_MS;
  }

  return Math.min(ttlMs, PAYPAL_WEBHOOK_CERT_CACHE_MAX_TTL_MS);
}

function getCertificateCacheTtlMs(headers) {
  const cacheControl = normalizeNonEmptyString(headers?.get?.("cache-control"));
  const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/i);

  if (!maxAgeMatch) {
    return PAYPAL_WEBHOOK_CERT_CACHE_DEFAULT_TTL_MS;
  }

  return clampCertificateCacheTtlMs(Number(maxAgeMatch[1]) * 1000);
}

function evictExpiredCertificateCacheEntries(cache, nowMs) {
  for (const [cacheKey, entry] of cache.entries()) {
    if (!entry || Number(entry.expiresAt) <= nowMs) {
      cache.delete(cacheKey);
    }
  }
}

function enforceCertificateCacheLimit(cache) {
  while (cache.size > PAYPAL_WEBHOOK_CERT_CACHE_MAX_ENTRIES) {
    const oldestCacheKey = cache.keys().next().value;
    if (!oldestCacheKey) break;
    cache.delete(oldestCacheKey);
  }
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  timeoutHandle.unref?.();

  return {
    signal: controller.signal,
    cancel() {
      clearTimeout(timeoutHandle);
    },
  };
}

async function readResponseBufferWithLimit(response, maxBytes) {
  const reader = response.body?.getReader?.();

  if (!reader) {
    const fallbackBuffer = Buffer.from(await response.arrayBuffer());
    if (fallbackBuffer.length > maxBytes) {
      throw buildWebhookVerificationError(
        "El certificado PayPal excede el tamano maximo permitido.",
        502,
      );
    }
    return fallbackBuffer;
  }

  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = Buffer.from(value);
    totalBytes += chunk.length;

    if (totalBytes > maxBytes) {
      throw buildWebhookVerificationError(
        "El certificado PayPal excede el tamano maximo permitido.",
        502,
      );
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks, totalBytes);
}

async function parseResponsePayload(response) {
  const rawText = await response.text();
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function buildSafePayPalError(response, payload, fallbackMessage) {
  const firstDetail = Array.isArray(payload?.details) ? payload.details[0] : null;

  return new PayPalApiError(
    firstDetail?.description || payload?.message || fallbackMessage,
    {
      statusCode: response?.status || Number(payload?.statusCode) || 502,
      code: firstDetail?.issue || payload?.name || null,
      details: payload
        ? {
            name: payload.name || null,
            debug_id: payload.debug_id || null,
            issue: firstDetail?.issue || null,
          }
        : null,
    },
  );
}

function resolvePayPalRequestTimeoutMs(timeoutMs) {
  const resolvedTimeoutMs = Number(timeoutMs ?? PAYPAL_REQUEST_TIMEOUT_MS);

  if (!Number.isInteger(resolvedTimeoutMs) || resolvedTimeoutMs <= 0) {
    throw new Error("PAYPAL_REQUEST_TIMEOUT_MS debe ser un entero positivo.");
  }

  return resolvedTimeoutMs;
}

function buildPayPalTimeoutError() {
  return new PayPalApiError(
    "La solicitud a PayPal excedio el tiempo maximo permitido.",
    {
      statusCode: 504,
      code: "PAYPAL_REQUEST_TIMEOUT",
      details: null,
    },
  );
}

async function executePayPalFetchJson(url, {
  method = "GET",
  headers = {},
  body,
  fetchImpl = globalThis.fetch,
  timeoutMs,
  fallbackMessage,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new PayPalApiError("No hay una implementacion de fetch disponible.", {
      statusCode: 500,
      code: "PAYPAL_FETCH_UNAVAILABLE",
      details: null,
    });
  }

  const timeout = createTimeoutController(resolvePayPalRequestTimeoutMs(timeoutMs));

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      signal: timeout.signal,
    });
    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw buildSafePayPalError(response, payload, fallbackMessage);
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw buildPayPalTimeoutError();
    }

    if (error instanceof PayPalApiError) {
      throw error;
    }

    throw new PayPalApiError(
      fallbackMessage || "No fue posible comunicarse con PayPal.",
      {
        statusCode: 502,
        code: "PAYPAL_REQUEST_FAILED",
        details: null,
      },
    );
  } finally {
    timeout.cancel();
  }
}

function buildWebhookCertificateCacheKey(url) {
  return url.toString();
}

function validateCertificatePublicKey(certificate) {
  try {
    if (!certificate?.publicKey) {
      throw new Error("Missing public key");
    }
  } catch {
    throw buildWebhookVerificationError(
      "El certificado PayPal descargado no contiene una clave publica valida.",
      502,
    );
  }
}

function normalizeCertificateDateValue(value, label) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw buildWebhookVerificationError(
        "El certificado PayPal contiene un periodo de vigencia invalido.",
        502,
      );
    }

    return new Date(value.getTime());
  }

  const parsedTime = Date.parse(String(value || ""));
  if (!Number.isFinite(parsedTime)) {
    throw buildWebhookVerificationError(
      `El certificado PayPal contiene ${label} invalido o no interpretable.`,
      502,
    );
  }

  return new Date(parsedTime);
}

export function validatePayPalCertificateValidity(
  certificate,
  {
    now = new Date(),
    clockSkewMs = PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS,
  } = {},
) {
  if (!certificate || typeof certificate !== "object") {
    throw buildWebhookVerificationError("El certificado PayPal no es un X.509 valido.", 502);
  }

  const nowDate = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  if (!Number.isFinite(nowDate.getTime())) {
    throw buildWebhookVerificationError("No fue posible validar la hora actual del certificado PayPal.", 500);
  }

  const skewMs = Number.isFinite(clockSkewMs) && clockSkewMs >= 0
    ? Number(clockSkewMs)
    : PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS;
  const validFrom = normalizeCertificateDateValue(
    certificate.validFromDate ?? certificate.validFrom,
    "validFrom",
  );
  const validTo = normalizeCertificateDateValue(
    certificate.validToDate ?? certificate.validTo,
    "validTo",
  );
  const validFromMs = validFrom.getTime();
  const validToMs = validTo.getTime();
  const nowMs = nowDate.getTime();

  if (validFromMs >= validToMs) {
    throw buildWebhookVerificationError(
      "El certificado PayPal contiene un periodo de vigencia invalido.",
      502,
    );
  }

  if (nowMs + skewMs < validFromMs) {
    throw buildWebhookVerificationError("El certificado PayPal aun no es valido.", 502);
  }

  if (nowMs - skewMs > validToMs) {
    throw buildWebhookVerificationError("El certificado PayPal esta expirado.", 502);
  }

  return {
    validFrom,
    validTo,
    validFromMs,
    validToMs,
  };
}

export function parsePayPalX509Certificate(
  certPem,
  {
    now = new Date(),
    clockSkewMs = PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS,
  } = {},
) {
  let certificate;

  try {
    certificate = new X509Certificate(certPem);
  } catch {
    throw buildWebhookVerificationError(
      "El certificado PayPal descargado no es un certificado X.509 valido.",
      502,
    );
  }

  validateCertificatePublicKey(certificate);
  const validity = validatePayPalCertificateValidity(certificate, {
    now,
    clockSkewMs,
  });

  return {
    certificate,
    validity,
  };
}

async function getPayPalWebhookCertificate(certUrl, {
  fetchImpl = globalThis.fetch,
  certificateCache = payPalWebhookCertificateCache,
  now = new Date(),
  clockSkewMs = PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS,
  parseCertificate = parsePayPalX509Certificate,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw buildWebhookVerificationError("No hay una implementacion de fetch disponible.", 500);
  }

  const parsedCertUrl = assertPayPalWebhookCertUrlAllowed(certUrl);
  const cacheKey = buildWebhookCertificateCacheKey(parsedCertUrl);
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  evictExpiredCertificateCacheEntries(certificateCache, nowMs);

  const cachedCertificate = certificateCache.get(cacheKey);
  if (cachedCertificate && Number(cachedCertificate.expiresAt) > nowMs) {
    try {
      validatePayPalCertificateValidity(cachedCertificate.certificate, {
        now,
        clockSkewMs,
      });
      return cachedCertificate.certificate;
    } catch (error) {
      certificateCache.delete(cacheKey);
      throw error;
    }
  }

  const timeout = createTimeoutController(PAYPAL_WEBHOOK_CERT_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetchImpl(cacheKey, {
      method: "GET",
      redirect: "error",
      signal: timeout.signal,
      headers: {
        Accept: "application/x-pem-file, application/pkix-cert, text/plain;q=0.9, */*;q=0.1",
      },
    });

    if (!response.ok) {
      throw buildWebhookVerificationError(
        "No fue posible descargar el certificado PayPal del webhook.",
        502,
      );
    }

    const declaredLength = Number(response.headers?.get?.("content-length") || NaN);
    if (
      Number.isFinite(declaredLength)
      && declaredLength > PAYPAL_WEBHOOK_CERT_MAX_BYTES
    ) {
      throw buildWebhookVerificationError(
        "El certificado PayPal excede el tamano maximo permitido.",
        502,
      );
    }

    const certificateBuffer = await readResponseBufferWithLimit(
      response,
      PAYPAL_WEBHOOK_CERT_MAX_BYTES,
    );
    const certPem = certificateBuffer.toString("utf8");

    if (!certPem.includes("BEGIN CERTIFICATE")) {
      throw buildWebhookVerificationError(
        "El certificado PayPal descargado no tiene un formato PEM valido.",
        502,
      );
    }

    const { certificate, validity } = parseCertificate(certPem, {
      now,
      clockSkewMs,
    });

    const ttlMs = getCertificateCacheTtlMs(response.headers);
    const effectiveExpiresAt = Math.min(nowMs + ttlMs, validity.validToMs);

    if (effectiveExpiresAt > nowMs) {
      certificateCache.set(cacheKey, {
        certificate,
        expiresAt: effectiveExpiresAt,
      });
      enforceCertificateCacheLimit(certificateCache);
    }

    return certificate;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw buildWebhookVerificationError(
        "La descarga del certificado PayPal excedio el tiempo maximo permitido.",
        502,
      );
    }

    if (error?.statusCode) {
      throw error;
    }

    throw buildWebhookVerificationError(
      "No fue posible validar criptograficamente el certificado PayPal del webhook.",
      502,
    );
  } finally {
    timeout.cancel();
  }
}

export async function paypalRequest(path, {
  method = "GET",
  accessToken,
  body,
  headers = {},
  fetchImpl = globalThis.fetch,
  timeoutMs,
} = {}) {
  return executePayPalFetchJson(`${PAYPAL_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    fetchImpl,
    timeoutMs,
    fallbackMessage: "PayPal rechazo la solicitud.",
  });
}

export function calculateCrc32UnsignedDecimal(rawBody) {
  if (!Buffer.isBuffer(rawBody)) {
    throw buildWebhookVerificationError(
      "No fue posible verificar la firma PayPal porque rawBody no esta disponible.",
      500,
    );
  }

  let crc = 0xffffffff;

  for (const byte of rawBody.values()) {
    crc = PAYPAL_WEBHOOK_CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return String((crc ^ 0xffffffff) >>> 0);
}

export function buildPayPalWebhookVerificationMessage({
  transmissionId,
  transmissionTime,
  webhookId,
  crc32,
}) {
  const normalizedTransmissionId = normalizeNonEmptyString(transmissionId);
  const normalizedTransmissionTime = normalizeNonEmptyString(transmissionTime);
  const normalizedWebhookId = normalizeNonEmptyString(webhookId);
  const normalizedCrc32 = normalizeNonEmptyString(crc32);

  if (
    !normalizedTransmissionId
    || !normalizedTransmissionTime
    || !normalizedWebhookId
    || !normalizedCrc32
  ) {
    throw buildWebhookVerificationError(
      "No fue posible construir el mensaje de verificacion del webhook PayPal.",
      400,
    );
  }

  return [
    normalizedTransmissionId,
    normalizedTransmissionTime,
    normalizedWebhookId,
    normalizedCrc32,
  ].join("|");
}

export function mapPayPalWebhookAuthAlgorithm(authAlgo) {
  const normalizedAuthAlgo = normalizeNonEmptyString(authAlgo)?.toUpperCase() || null;
  if (!normalizedAuthAlgo) return null;
  return PAYPAL_WEBHOOK_VERIFY_ALGORITHMS.get(normalizedAuthAlgo) || null;
}

export function assertPayPalWebhookCertUrlAllowed(certUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(certUrl);
  } catch {
    throw buildWebhookVerificationError("paypal-cert-url no es una URL valida.", 400);
  }

  if (parsedUrl.protocol !== "https:") {
    throw buildWebhookVerificationError("paypal-cert-url debe usar HTTPS.", 400);
  }

  if (!PAYPAL_WEBHOOK_ALLOWED_CERT_HOSTS.has(parsedUrl.hostname)) {
    throw buildWebhookVerificationError("paypal-cert-url no pertenece a un host PayPal permitido.", 400);
  }

  if (parsedUrl.port && parsedUrl.port !== "443") {
    throw buildWebhookVerificationError("paypal-cert-url usa un puerto no permitido.", 400);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw buildWebhookVerificationError("paypal-cert-url no puede incluir credenciales.", 400);
  }

  if (!parsedUrl.pathname.startsWith(PAYPAL_WEBHOOK_CERT_PATH_PREFIX)) {
    throw buildWebhookVerificationError(
      "paypal-cert-url no apunta a la ruta oficial de certificados PayPal.",
      400,
    );
  }

  if (parsedUrl.search || parsedUrl.hash) {
    throw buildWebhookVerificationError(
      "paypal-cert-url no puede incluir query string ni fragmento.",
      400,
    );
  }

  return parsedUrl;
}

export async function verifyPayPalWebhookSignatureLocal({
  rawBody,
  headers,
  webhookId,
  fetchImpl = globalThis.fetch,
  certificateCache = payPalWebhookCertificateCache,
  now = new Date(),
  clockSkewMs = PAYPAL_WEBHOOK_CERT_CLOCK_SKEW_MS,
  parseCertificate = parsePayPalX509Certificate,
}) {
  const normalizedWebhookId = normalizeNonEmptyString(webhookId);
  if (!normalizedWebhookId) {
    throw buildWebhookVerificationError(
      "PAYPAL_WEBHOOK_ID no esta configurado. Configuralo antes de aceptar webhooks PayPal.",
      500,
    );
  }

  if (!Buffer.isBuffer(rawBody)) {
    throw buildWebhookVerificationError(
      "No fue posible verificar la firma PayPal porque rawBody no esta disponible.",
      500,
    );
  }

  const normalizedHeaders = normalizeWebhookHeaders(headers);
  const transmissionId = getWebhookHeader(normalizedHeaders, "paypal-transmission-id");
  const transmissionTime = getWebhookHeader(normalizedHeaders, "paypal-transmission-time");
  const transmissionSig = assertWebhookSignatureBase64(
    getWebhookHeader(normalizedHeaders, "paypal-transmission-sig"),
  );
  const certUrl = getWebhookHeader(normalizedHeaders, "paypal-cert-url");
  const authAlgo = getWebhookHeader(normalizedHeaders, "paypal-auth-algo");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo) {
    throw buildWebhookVerificationError(
      "Faltan encabezados requeridos para verificar la firma PayPal del webhook.",
      400,
    );
  }

  const verifyAlgorithm = mapPayPalWebhookAuthAlgorithm(authAlgo);
  if (!verifyAlgorithm) {
    throw buildWebhookVerificationError(
      "paypal-auth-algo no es soportado en Fase 6.2. Solo se acepta SHA256withRSA.",
      400,
    );
  }

  const certificate = await getPayPalWebhookCertificate(certUrl, {
    fetchImpl,
    certificateCache,
    now,
    clockSkewMs,
    parseCertificate,
  });
  const message = buildPayPalWebhookVerificationMessage({
    transmissionId,
    transmissionTime,
    webhookId: normalizedWebhookId,
    crc32: calculateCrc32UnsignedDecimal(rawBody),
  });
  const signature = Buffer.from(transmissionSig, "base64");

  if (!signature.length) {
    throw buildWebhookVerificationError("paypal-transmission-sig no es base64 valido.", 400);
  }

  return verify(
    verifyAlgorithm,
    Buffer.from(message, "utf8"),
    certificate.publicKey,
    signature,
  );
}

export function clearPayPalWebhookCertificateCache() {
  payPalWebhookCertificateCache.clear();
}

export async function getPayPalAccessToken() {
  assertPayPalConfig();

  const payload = await executePayPalFetchJson(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    fallbackMessage: "No fue posible autenticarse con PayPal.",
  });

  if (!payload?.access_token) {
    throw new PayPalApiError("No fue posible autenticarse con PayPal.", {
      statusCode: 502,
      code: "PAYPAL_AUTH_INVALID_RESPONSE",
      details: null,
    });
  }

  return payload.access_token;
}

export function extractPayPalApprovalUrl(paypalOrder) {
  if (!Array.isArray(paypalOrder?.links)) return null;

  const approvalLink = paypalOrder.links.find((link) =>
    ["approve", "payer-action"].includes(String(link?.rel || "").toLowerCase()),
  );

  return approvalLink?.href || null;
}

export async function createPayPalOrder({
  amount,
  currency,
  description,
  customId,
  returnUrl,
  cancelUrl,
}) {
  const accessToken = await getPayPalAccessToken();
  const purchaseUnit = {
    amount: {
      currency_code: currency,
      value: Number(amount).toFixed(2),
    },
  };

  if (description) purchaseUnit.description = description;
  if (customId) purchaseUnit.custom_id = customId;

  return paypalRequest("/v2/checkout/orders", {
    method: "POST",
    accessToken,
    body: {
      intent: "CAPTURE",
      purchase_units: [purchaseUnit],
      application_context: {
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });
}

export async function capturePayPalOrder(paypalOrderId) {
  const accessToken = await getPayPalAccessToken();

  return paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    accessToken,
  });
}

export async function getPayPalOrder(paypalOrderId) {
  const accessToken = await getPayPalAccessToken();

  return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`, {
    method: "GET",
    accessToken,
  });
}

export async function getPayPalCapture(paypalCaptureId) {
  const accessToken = await getPayPalAccessToken();

  return paypalRequest(`/v2/payments/captures/${paypalCaptureId}`, {
    method: "GET",
    accessToken,
  });
}

export async function getPayPalRefund(paypalRefundId) {
  const accessToken = await getPayPalAccessToken();

  return paypalRequest(`/v2/payments/refunds/${paypalRefundId}`, {
    method: "GET",
    accessToken,
  });
}

export async function refundPayPalCapture(paypalCaptureId, {
  amount,
  currencyCode,
  requestId,
  noteToPayer = null,
} = {}) {
  const accessToken = await getPayPalAccessToken();
  const body = {};

  if (amount !== undefined && amount !== null) {
    body.amount = {
      currency_code: currencyCode,
      value: Number(amount).toFixed(2),
    };
  }

  if (noteToPayer) {
    body.note_to_payer = noteToPayer;
  }

  return paypalRequest(`/v2/payments/captures/${paypalCaptureId}/refund`, {
    method: "POST",
    accessToken,
    body,
    headers: requestId
      ? {
          "PayPal-Request-Id": requestId,
        }
      : {},
  });
}

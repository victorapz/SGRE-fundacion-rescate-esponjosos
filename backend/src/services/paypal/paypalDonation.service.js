"use strict";

import { createHash, randomUUID } from "crypto";
import { In } from "typeorm";
import {
  PAYPAL_CURRENCY,
  PAYPAL_DONATION_CANCEL_URL,
  PAYPAL_DONATION_SUCCESS_URL,
} from "../../config/configEnv.js";
import {
  AppDataSource,
  Donor,
  PaymentOrder,
  Transaction,
  getPaymentProviderByKeyOrThrow,
  getTransactionCategoryByKeyOrThrow,
  isUniqueConstraintError,
  mapPaymentOrder,
  mapTransaction,
  normalizeCode,
  normalizeCurrency,
  normalizeNullableString,
  toIsoTimestamp,
  toNumericNumber,
} from "../financialConcept/accounting.shared.js";
import {
  PayPalApiError,
  capturePayPalOrder,
  createPayPalOrder,
  extractPayPalApprovalUrl,
  getPayPalCapture,
  getPayPalOrder,
  getPayPalRefund,
  refundPayPalCapture,
} from "./paypal.service.js";

const PAYPAL_PROVIDER_KEY = "PAYPAL";
const DONATION_CATEGORY_KEY = "DONACION_UNICA";
const DONATION_REFUND_CATEGORY_KEY = "DEVOLUCION_DONACION";
const PAYPAL_REVERSAL_CATEGORY_KEY = "REVERSA_PAYPAL";
const PAYMENT_ORDER_CREATED_STATE = "CREADA";
const PAYMENT_ORDER_APPROVED_STATE = "APROBADA";
const PAYMENT_ORDER_CAPTURED_STATE = "CAPTURADA";
const PAYMENT_ORDER_FAILED_STATE = "FALLIDA";
const PAYMENT_ORDER_REFUNDED_STATE = "REEMBOLSADA";
const DONOR_IDENTITY_MODE_IDENTIFIED = "IDENTIFIED";
const DONOR_IDENTITY_MODE_ANONYMOUS = "ANONYMOUS";
const DONOR_IDENTITY_MODE_UNIDENTIFIED = "UNIDENTIFIED";
const DONOR_LINK_STATUS_PENDING = "PENDING";
const DONOR_LINK_STATUS_LINKED = "LINKED";
const DONOR_LINK_STATUS_NOT_APPLICABLE = "NOT_APPLICABLE";
const DONOR_LINK_STATUS_ERROR = "ERROR";
const DONOR_LINK_STATUS_MISSING_PAYER_EMAIL = "MISSING_PAYER_EMAIL";
const DONOR_LINK_STATUS_MISSING_PAYER_NAME = "MISSING_PAYER_NAME";
const DONOR_LINK_STATUS_MISSING_PAYER_SURNAME = "MISSING_PAYER_SURNAME";
const DONOR_IDENTITY_SOURCE_PAYPAL_PAYER = "PAYPAL_PAYER";
const PAYPAL_PAYER_SNAPSHOT_SOURCE_CAPTURE = "PAYPAL_CAPTURE";
const PAYPAL_PAYER_SNAPSHOT_SOURCE_ORDER = "PAYPAL_ORDER";
const PAYPAL_PAYER_SNAPSHOT_SOURCE_VERIFIED_ORDER_APPROVED = "VERIFIED_CHECKOUT_ORDER_APPROVED";
const PAYPAL_PAYER_SNAPSHOT_SOURCE_VERIFIED_CAPTURE_COMPLETED = "VERIFIED_CAPTURE_COMPLETED";
const TRUSTED_PAYPAL_PAYER_SNAPSHOT_SOURCES = new Set([
  PAYPAL_PAYER_SNAPSHOT_SOURCE_CAPTURE,
  PAYPAL_PAYER_SNAPSHOT_SOURCE_ORDER,
  PAYPAL_PAYER_SNAPSHOT_SOURCE_VERIFIED_ORDER_APPROVED,
  PAYPAL_PAYER_SNAPSHOT_SOURCE_VERIFIED_CAPTURE_COMPLETED,
]);
const CONFIRMED_TRANSACTION_STATES = ["CONFIRMADA", "COMPLETADA"];
const PAYPAL_FAILED_CAPTURE_STATUSES = new Set(["DENIED", "DECLINED", "VOIDED", "FAILED"]);
const MINOR_UNIT_SCALE_BY_CURRENCY = Object.freeze({
  USD: 2,
  EUR: 2,
  CLP: 0,
});
export const DONATION_REFUND_WINDOW_HOURS = 48;
const DONATION_REFUND_WINDOW_MS = DONATION_REFUND_WINDOW_HOURS * 60 * 60 * 1000;
const ADMIN_DONATION_REFUND_SOURCE = "admin:accounting-donations-refund";
const ADMIN_DONATION_REFUND_FLOW_KEY = "ADMIN_ACCOUNTING_DONATIONS";
const DONOR_MODEL_TEXT_MAX_LENGTH = 255;
const FORBIDDEN_METADATA_KEYS = new Set([
  "authorization",
  "access_token",
  "refresh_token",
  "token",
  "secret",
  "client_secret",
  "password",
  "signature",
  "payer_id",
]);
const PAYPAL_API_ALLOWED_HOSTS = new Set([
  "api.sandbox.paypal.com",
  "api-m.sandbox.paypal.com",
  "api.paypal.com",
  "api-m.paypal.com",
]);

function buildServiceError(message, statusCode = 400) {
  return { message, statusCode };
}

function collapseInternalWhitespace(value) {
  return value.replace(/\s+/g, " ");
}

function normalizeCollapsedText(value) {
  const normalized = normalizeNullableString(value);
  return normalized ? collapseInternalWhitespace(normalized) : null;
}

export function normalizeDonorEmail(value) {
  const normalized = normalizeNullableString(value);
  if (!normalized) return null;

  const normalizedEmail = normalized.toLowerCase();
  if (normalizedEmail.length > 255 || !isValidEmailFormat(normalizedEmail)) {
    throw buildServiceError("El email del donante debe ser valido.", 400);
  }

  return normalizedEmail;
}

function normalizePhone(value) {
  const normalized = normalizeCollapsedText(value);
  return normalized || null;
}

function normalizeRefundReason(value, { statusCode = 400 } = {}) {
  const normalized = normalizeCollapsedText(value);

  if (!normalized || normalized.length < 3) {
    throw buildServiceError("El motivo del reembolso es obligatorio.", statusCode);
  }

  if (normalized.length > 255) {
    throw buildServiceError(
      "El motivo del reembolso debe tener como maximo 255 caracteres.",
      statusCode,
    );
  }

  return normalized;
}

function normalizeDonorModelText(value, fieldLabel, {
  required = false,
  maxLength = DONOR_MODEL_TEXT_MAX_LENGTH,
  statusCode = 409,
} = {}) {
  const normalized = normalizeCollapsedText(value);

  if (!normalized) {
    if (required) {
      throw buildServiceError(`${fieldLabel} es obligatorio.`, statusCode);
    }

    return null;
  }

  if (normalized.length > maxLength) {
    throw buildServiceError(
      `${fieldLabel} debe tener como maximo ${maxLength} caracteres.`,
      statusCode,
    );
  }

  return normalized;
}

function normalizeDonorIdentityForPersistence(donorInput, { statusCode = 409 } = {}) {
  const nombre = normalizeDonorModelText(
    donorInput?.nombre,
    "El nombre del donante",
    { required: true, statusCode },
  );
  const apellido = normalizeDonorModelText(
    donorInput?.apellido,
    "El apellido del donante",
    { required: true, statusCode },
  );
  const email = normalizeDonorEmail(donorInput?.email);

  if (!email) {
    throw buildServiceError("El email del donante es obligatorio.", statusCode);
  }

  return { nombre, apellido, email };
}

function assertExistingDonorIsLinkable(donor) {
  if (!donor) return null;

  const email = normalizeDonorEmail(donor.email);
  if (!email) {
    throw buildServiceError(
      "Existe un Donor historico con el mismo email pero con email invalido. Corrige ese registro antes de asociarlo.",
      409,
    );
  }

  const nombre = normalizeCollapsedText(donor.nombre);
  if (!nombre) {
    throw buildServiceError(
      "Existe un Donor historico con el mismo email pero sin nombre. Corrige ese registro antes de asociarlo.",
      409,
    );
  }

  const apellido = normalizeCollapsedText(donor.apellido);
  if (!apellido) {
    throw buildServiceError(
      "Existe un Donor historico con el mismo email pero sin apellido. Corrige ese registro antes de asociarlo.",
      409,
    );
  }

  return {
    ...donor,
    nombre,
    apellido,
    email,
  };
}

function isValidEmailFormat(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function normalizePayPalApiUrl(url, { expectedPathPattern, label }) {
  const normalizedUrl = normalizeNullableString(url);

  if (!normalizedUrl) {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new Error(`${label} no es una URL PayPal valida.`);
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(`${label} debe usar HTTPS.`);
  }

  if (!PAYPAL_API_ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(`${label} no pertenece a un host PayPal permitido.`);
  }

  if (parsedUrl.port && parsedUrl.port !== "443") {
    throw new Error(`${label} usa un puerto no permitido.`);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} no puede incluir credenciales.`);
  }

  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error(`${label} no puede incluir query string ni fragmento.`);
  }

  const matchedPath = parsedUrl.pathname.match(expectedPathPattern);
  const resolvedId = normalizeNullableString(matchedPath?.[1]);

  if (!resolvedId) {
    throw new Error(`${label} no apunta al recurso PayPal esperado.`);
  }

  return resolvedId;
}

function resolveIdFromPayPalUpLink(links, { expectedPathPattern, label }) {
  const upLink = Array.isArray(links)
    ? links.find((link) => String(link?.rel || "").toLowerCase() === "up")
    : null;

  if (!upLink?.href) {
    return null;
  }

  return normalizePayPalApiUrl(upLink.href, {
    expectedPathPattern,
    label,
  });
}

function getMinorUnitScale(currencyCode) {
  const normalizedCurrency = normalizeCurrency(currencyCode);
  const scale = MINOR_UNIT_SCALE_BY_CURRENCY[normalizedCurrency];

  if (!Number.isInteger(scale)) {
    throw new Error(`La moneda ${normalizedCurrency} no esta soportada para calculos monetarios seguros.`);
  }

  return scale;
}

export function toMinorUnits(value, currencyCode) {
  const scale = getMinorUnitScale(currencyCode);
  const normalizedValue = normalizeNullableString(value);
  const valueAsString = normalizedValue ?? (
    typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null
  );

  if (!valueAsString || !/^-?\d+(?:\.\d+)?$/.test(valueAsString)) {
    throw new Error(`El monto ${value ?? ""} no es valido para la moneda ${normalizeCurrency(currencyCode)}.`);
  }

  const sign = valueAsString.startsWith("-") ? -1 : 1;
  const unsignedValue = sign === -1 ? valueAsString.slice(1) : valueAsString;
  const [wholePart, fractionPartRaw = ""] = unsignedValue.split(".");
  const fractionPart = fractionPartRaw.trim();

  if (fractionPart.length > scale) {
    throw new Error(
      `El monto ${valueAsString} excede los decimales soportados para ${normalizeCurrency(currencyCode)}.`,
    );
  }

  if (scale === 0 && /[1-9]/.test(fractionPart)) {
    throw new Error(`La moneda ${normalizeCurrency(currencyCode)} no admite decimales.`);
  }

  const paddedFraction = scale > 0
    ? fractionPart.padEnd(scale, "0")
    : "";
  const minorUnitText = `${wholePart}${paddedFraction}`;
  const minorUnits = sign * Number(minorUnitText || "0");

  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error(`El monto ${valueAsString} excede el rango seguro soportado.`);
  }

  return minorUnits;
}

export function fromMinorUnits(minorUnits, currencyCode) {
  const scale = getMinorUnitScale(currencyCode);

  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error("Las unidades menores indicadas no son un entero seguro.");
  }

  if (scale === 0) {
    return minorUnits;
  }

  const sign = minorUnits < 0 ? "-" : "";
  const absoluteMinorUnits = Math.abs(minorUnits);
  const factor = 10 ** scale;
  const wholePart = Math.floor(absoluteMinorUnits / factor);
  const fractionPart = String(absoluteMinorUnits % factor).padStart(scale, "0");

  return Number(`${sign}${wholePart}.${fractionPart}`);
}

function normalizeStoredMoney(value, currencyCode) {
  return fromMinorUnits(toMinorUnits(value, currencyCode), currencyCode);
}

function areAmountsEquivalent(left, right, currencyCode) {
  return toMinorUnits(left, currencyCode) === toMinorUnits(right, currencyCode);
}

function sumMoneyAmounts(values, currencyCode) {
  const totalMinorUnits = values.reduce(
    (total, currentValue) => total + toMinorUnits(currentValue, currencyCode),
    0,
  );

  return fromMinorUnits(totalMinorUnits, currencyCode);
}

function calculateNetAmountUsingMinorUnits(grossAmount, feeAmount, currencyCode) {
  const grossMinorUnits = toMinorUnits(grossAmount, currencyCode);
  const feeMinorUnits = toMinorUnits(feeAmount, currencyCode);

  if (grossMinorUnits < 0) {
    throw new Error("El monto bruto no puede ser negativo.");
  }
  if (feeMinorUnits < 0) {
    throw new Error("El monto fee no puede ser negativo.");
  }
  if (feeMinorUnits > grossMinorUnits) {
    throw new Error("El monto fee no puede ser mayor al monto bruto.");
  }

  return fromMinorUnits(grossMinorUnits - feeMinorUnits, currencyCode);
}

function parseValidDateCandidate(value) {
  if (!value) return null;
  const candidate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

export function resolveDonationRefundConfirmationDate(paymentOrder, captureTransaction = null) {
  const candidates = [
    paymentOrder?.capturada_en,
    captureTransaction?.fecha_transaccion,
  ];

  for (const candidate of candidates) {
    const parsed = parseValidDateCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function getDonationRefundWindowInfo(paymentOrder, captureTransaction = null, {
  now = new Date(),
} = {}) {
  const confirmedAt = resolveDonationRefundConfirmationDate(paymentOrder, captureTransaction);
  const nowDate = parseValidDateCandidate(now) || new Date();

  if (!confirmedAt) {
    return {
      confirmedAt: null,
      availableUntil: null,
      remainingMs: 0,
      withinWindow: false,
    };
  }

  const availableUntil = new Date(confirmedAt.getTime() + DONATION_REFUND_WINDOW_MS);
  const remainingMs = Math.max(availableUntil.getTime() - nowDate.getTime(), 0);

  return {
    confirmedAt,
    availableUntil,
    remainingMs,
    withinWindow: nowDate.getTime() <= availableUntil.getTime(),
  };
}

export function getDonationRefundEligibility(paymentOrder, captureTransaction = null, {
  now = new Date(),
  remainingAmount = null,
  hasReversal = false,
} = {}) {
  const providerKey = normalizeCode(
    paymentOrder?.payment_provider?.clave || paymentOrder?.payment_provider?.tipo,
  );
  const captureId = normalizeNullableString(
    captureTransaction?.referencia_externa || paymentOrder?.metadata?.paypal?.capture_id,
  );
  const paymentOrderStatus = normalizeCode(paymentOrder?.estado);
  const transactionStatus = normalizeCode(captureTransaction?.estado);
  const refundWindow = getDonationRefundWindowInfo(paymentOrder, captureTransaction, { now });
  const remainingAmountNumber = remainingAmount === null
    ? null
    : normalizeStoredMoney(remainingAmount, paymentOrder?.moneda || PAYPAL_CURRENCY);

  if (!paymentOrder || Number(paymentOrder?.orden_pago_id || 0) <= 0) {
    return { canRefund: false, reason: "La donacion indicada no existe.", refundWindow };
  }

  if (normalizeCode(paymentOrder?.proposito) !== DONATION_CATEGORY_KEY) {
    return {
      canRefund: false,
      reason: "Solo se pueden reembolsar ordenes DONACION_UNICA desde este flujo.",
      refundWindow,
    };
  }

  if (providerKey !== PAYPAL_PROVIDER_KEY) {
    return {
      canRefund: false,
      reason: "Solo las donaciones PayPal pueden reembolsarse automaticamente en esta fase.",
      refundWindow,
    };
  }

  if (!captureId || !captureTransaction) {
    return {
      canRefund: false,
      reason: "La donacion no tiene una captura PayPal confirmada.",
      refundWindow,
    };
  }

  if (!["CONFIRMADA", "COMPLETADA"].includes(transactionStatus)) {
    return {
      canRefund: false,
      reason: "La captura PayPal original no esta confirmada contablemente.",
      refundWindow,
    };
  }

  if (!["CAPTURADA", "REEMBOLSADA"].includes(paymentOrderStatus)) {
    return {
      canRefund: false,
      reason: "La orden de pago no se encuentra en un estado elegible para refund.",
      refundWindow,
    };
  }

  if (paymentOrderStatus === "CANCELADA") {
    return {
      canRefund: false,
      reason: "Las donaciones canceladas no pueden reembolsarse.",
      refundWindow,
    };
  }

  if (!refundWindow.confirmedAt) {
    return {
      canRefund: false,
      reason: "No fue posible determinar de forma segura la fecha de captura de esta donacion. El reembolso no puede realizarse.",
      refundWindow,
    };
  }

  if (hasReversal) {
    return {
      canRefund: false,
      reason: "La donacion ya tiene una reversa PayPal asociada.",
      refundWindow,
    };
  }

  if (!refundWindow.withinWindow) {
    return {
      canRefund: false,
      reason: "El plazo de 48 horas para reembolsar esta donacion ha finalizado.",
      refundWindow,
    };
  }

  if (remainingAmountNumber !== null && remainingAmountNumber <= 0) {
    return {
      canRefund: false,
      reason: "La donacion ya no tiene saldo reembolsable disponible.",
      refundWindow,
    };
  }

  return {
    canRefund: true,
    reason: null,
    refundWindow,
  };
}

export function normalizePublicDonorData(donor) {
  if (!donor || typeof donor !== "object" || Array.isArray(donor)) return null;

  const nombre = normalizeCollapsedText(donor.nombre);
  const apellido = normalizeCollapsedText(donor.apellido);
  const email = donor.email === undefined || donor.email === null || donor.email === ""
    ? null
    : normalizeDonorEmail(donor.email);
  const telefono = normalizePhone(donor.telefono);

  if (!nombre && !apellido && !email && !telefono) {
    return null;
  }

  return {
    nombre,
    apellido,
    email,
    telefono,
    nombreCompleto: normalizeCollapsedText([nombre, apellido].filter(Boolean).join(" ")),
  };
}

function buildDonationIdentityMetadata(baseMetadata, {
  identityMode,
  linkStatus,
  donorPublicData,
  consentimientoDatos,
  donorId,
  identitySource,
  linkError,
  linkErrorCode,
  attemptedAt,
  linkedAt,
} = {}) {
  const metadata = sanitizeMetadataValue({
    ...(baseMetadata || {}),
  });

  if (identityMode) {
    metadata.donor_identity_mode = identityMode;
  } else {
    delete metadata.donor_identity_mode;
  }

  if (linkStatus) {
    metadata.donor_link_status = linkStatus;
  } else {
    delete metadata.donor_link_status;
  }

  if (donorPublicData) {
    metadata.donor_public_data = buildPublicDonorMetadata(donorPublicData);
  } else {
    delete metadata.donor_public_data;
  }

  if (consentimientoDatos === true) {
    metadata.donor_consentimiento_datos = true;
  } else {
    delete metadata.donor_consentimiento_datos;
  }

  if (donorId) {
    metadata.donor_id = Number(donorId);
  } else {
    delete metadata.donor_id;
  }

  if (identitySource) {
    metadata.donor_identity_source = identitySource;
  } else {
    delete metadata.donor_identity_source;
  }

  if (linkError) {
    metadata.donor_link_error = linkError;
  } else {
    delete metadata.donor_link_error;
  }

  if (linkErrorCode) {
    metadata.donor_link_error_code = linkErrorCode;
  } else {
    delete metadata.donor_link_error_code;
  }

  if (attemptedAt) {
    metadata.donor_link_attempted_at = attemptedAt;
  } else {
    delete metadata.donor_link_attempted_at;
  }

  if (linkedAt) {
    metadata.donor_linked_at = linkedAt;
  } else {
    delete metadata.donor_linked_at;
  }

  return metadata;
}

function getDonationIdentityMode(metadata) {
  return normalizeNullableString(metadata?.donor_identity_mode) || DONOR_IDENTITY_MODE_UNIDENTIFIED;
}

function isDonationMarkedAsAnonymous(metadata) {
  return getDonationIdentityMode(metadata) === DONOR_IDENTITY_MODE_ANONYMOUS;
}

function hasAnyDonorIdentityValue(identity) {
  return Boolean(identity?.email || identity?.nombre || identity?.apellido);
}

function hasCompleteDonorIdentity(identity) {
  return Boolean(identity?.email && identity?.nombre && identity?.apellido);
}

function normalizeStoredPayPalPayerIdentity(payer) {
  if (!payer || typeof payer !== "object" || Array.isArray(payer)) {
    return null;
  }

  return {
    nombre: normalizeDonorModelText(payer.nombre, "El nombre del donante", {
      required: false,
      statusCode: 409,
    }),
    apellido: normalizeDonorModelText(payer.apellido, "El apellido del donante", {
      required: false,
      statusCode: 409,
    }),
    email: payer.email ? normalizeDonorEmail(payer.email) : null,
  };
}

function pickBestPayPalPayerIdentity(candidates) {
  if (!Array.isArray(candidates)) return null;

  const normalizedCandidates = candidates.filter((candidate) => hasAnyDonorIdentityValue(candidate));

  return normalizedCandidates.find((candidate) => hasCompleteDonorIdentity(candidate))
    || normalizedCandidates[0]
    || null;
}

function buildPayPalPayerCandidate(identity, {
  source = null,
  orderId = null,
  captureId = null,
  recordedAt = null,
} = {}) {
  const normalizedIdentity = normalizeStoredPayPalPayerIdentity(identity);
  if (!hasAnyDonorIdentityValue(normalizedIdentity)) {
    return null;
  }

  return {
    identity: normalizedIdentity,
    source: normalizeNullableString(source),
    orderId: normalizeNullableString(orderId),
    captureId: normalizeNullableString(captureId),
    recordedAt: normalizeNullableString(recordedAt) || toIsoTimestamp(new Date()),
  };
}

function pickBestPayPalPayerCandidate(candidates) {
  if (!Array.isArray(candidates)) return null;

  const normalizedCandidates = candidates.filter((candidate) => hasAnyDonorIdentityValue(candidate?.identity));

  return normalizedCandidates.find((candidate) => hasCompleteDonorIdentity(candidate?.identity))
    || normalizedCandidates[0]
    || null;
}

function buildTrustedPayPalPayerSnapshot(candidate) {
  if (!candidate?.identity || !TRUSTED_PAYPAL_PAYER_SNAPSHOT_SOURCES.has(candidate?.source)) {
    return null;
  }

  return {
    paypal_payer_snapshot: {
      nombre: candidate.identity.nombre || null,
      apellido: candidate.identity.apellido || null,
      email: candidate.identity.email || null,
    },
    paypal_payer_snapshot_source: candidate.source,
    paypal_payer_snapshot_order_id: candidate.orderId || null,
    paypal_payer_snapshot_capture_id: candidate.captureId || null,
    paypal_payer_snapshot_recorded_at: candidate.recordedAt || toIsoTimestamp(new Date()),
  };
}

function resolveTrustedStoredPayPalPayerCandidate(snapshotContainer, {
  expectedOrderId = null,
  expectedCaptureId = null,
} = {}) {
  if (!snapshotContainer || typeof snapshotContainer !== "object" || Array.isArray(snapshotContainer)) {
    return null;
  }

  const source = normalizeNullableString(snapshotContainer.paypal_payer_snapshot_source);
  if (!TRUSTED_PAYPAL_PAYER_SNAPSHOT_SOURCES.has(source)) {
    return null;
  }

  const snapshotOrderId = normalizeNullableString(snapshotContainer.paypal_payer_snapshot_order_id);
  if (!snapshotOrderId || (expectedOrderId && snapshotOrderId !== normalizeNullableString(expectedOrderId))) {
    return null;
  }

  const snapshotCaptureId = normalizeNullableString(snapshotContainer.paypal_payer_snapshot_capture_id);
  if (
    expectedCaptureId
    && snapshotCaptureId
    && snapshotCaptureId !== normalizeNullableString(expectedCaptureId)
  ) {
    return null;
  }

  return buildPayPalPayerCandidate(snapshotContainer.paypal_payer_snapshot, {
    source,
    orderId: snapshotOrderId,
    captureId: snapshotCaptureId,
    recordedAt: snapshotContainer.paypal_payer_snapshot_recorded_at,
  });
}

function getLinkedDonorId(entity) {
  return Number(entity?.donor?.donante_id || 0) || null;
}

function isDonationDonorFullyLinked(paymentOrder, transaction) {
  const paymentOrderDonorId = getLinkedDonorId(paymentOrder);
  const transactionDonorId = getLinkedDonorId(transaction);

  return Boolean(
    paymentOrderDonorId
    && transactionDonorId
    && paymentOrderDonorId === transactionDonorId,
  );
}

export function resolveDonationIdentityIntent({
  anonymous = false,
  donor = null,
} = {}) {
  const donorPublicData = normalizePublicDonorData(donor);
  const hasDonorIdentity = Boolean(donorPublicData);

  if (anonymous && hasDonorIdentity) {
    throw buildServiceError(
      "No puedes enviar donor cuando anonymous=true.",
      400,
    );
  }

  if (anonymous) {
    return {
      anonymous: true,
      identityMode: DONOR_IDENTITY_MODE_ANONYMOUS,
      linkStatus: DONOR_LINK_STATUS_NOT_APPLICABLE,
      donorPublicData: null,
    };
  }

  return {
    anonymous: false,
    identityMode: DONOR_IDENTITY_MODE_IDENTIFIED,
    linkStatus: DONOR_LINK_STATUS_PENDING,
    donorPublicData,
  };
}

function sanitizeMetadataValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeMetadataValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((sanitized, [key, nestedValue]) => {
    const normalizedKey = String(key || "").trim().toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.has(normalizedKey)) {
      return sanitized;
    }

    sanitized[key] = sanitizeMetadataValue(nestedValue);
    return sanitized;
  }, {});
}

export function buildPayPalIdempotencyKey(paypalCaptureId) {
  return `paypal:capture:${paypalCaptureId}`;
}

export function buildPayPalRefundIdempotencyKey(paypalRefundId) {
  return `paypal:refund:${paypalRefundId}`;
}

export function buildPayPalReversalIdempotencyKey(reversalFactId) {
  return `paypal:reversal:${reversalFactId}`;
}

function mergeOrderMetadata(order, nextMetadata) {
  return {
    ...(order?.metadata || {}),
    ...(nextMetadata || {}),
  };
}

function buildPublicDonorMetadata(donorInput) {
  if (!donorInput) return null;

  return {
    nombre: donorInput.nombre || null,
    apellido: donorInput.apellido || null,
    email: donorInput.email || null,
    telefono: donorInput.telefono || null,
  };
}

function isAlreadyCapturedPayPalError(error) {
  if (!(error instanceof PayPalApiError)) return false;

  return [error.code, error.details?.issue, error.details?.name]
    .filter(Boolean)
    .some((value) => String(value).toUpperCase().includes("ORDER_ALREADY_CAPTURED"));
}

export function mapCreateOrderResult(order) {
  return {
    orden_pago_id: order.orden_pago_id,
    paypal_order_id: order.proveedor_orden_id,
    approval_url: order.approval_url,
    status: order.estado,
    anonymous: isDonationMarkedAsAnonymous(order.metadata),
    donor_linked: false,
  };
}

export function mapCaptureOrderPublicResult(result) {
  return {
    orden_pago_id: result?.orden_pago?.orden_pago_id || null,
    paypal_order_id: result?.paypal_order_id || result?.orden_pago?.proveedor_orden_id || null,
    paypal_capture_id: result?.paypal_capture_id || null,
    status: result?.status || result?.orden_pago?.estado || "",
    idempotente: Boolean(result?.idempotente),
    anonymous: isDonationMarkedAsAnonymous(result?.orden_pago?.metadata),
    donor_linked: isDonationDonorFullyLinked(
      result?.orden_pago || null,
      result?.transaccion || null,
    ),
  };
}

function pickPayPalPayer(payer) {
  if (!payer || typeof payer !== "object") return null;

  return {
    nombre: normalizeDonorModelText(payer?.name?.given_name, "El nombre del donante", {
      required: false,
      statusCode: 409,
    }),
    apellido: normalizeDonorModelText(payer?.name?.surname, "El apellido del donante", {
      required: false,
      statusCode: 409,
    }),
    email: payer?.email_address ? normalizeDonorEmail(payer.email_address) : null,
  };
}

export function normalizePayPalPayerIdentity(capture) {
  if (!capture || typeof capture !== "object" || Array.isArray(capture)) {
    return null;
  }

  const payerIdentity = pickPayPalPayer(capture?.payer);
  if (!payerIdentity) return null;

  return {
    nombre: payerIdentity.nombre,
    apellido: payerIdentity.apellido,
    email: payerIdentity.email,
  };
}

function resolvePreferredTrustedPayPalPayerCandidate({
  capture = null,
  payer = null,
  payerSource = null,
  storedOrderSnapshotContainer = null,
  storedTransactionSnapshotContainer = null,
  paypalOrderId = null,
  paypalCaptureId = null,
} = {}) {
  return pickBestPayPalPayerCandidate([
    buildPayPalPayerCandidate(normalizePayPalPayerIdentity(capture), {
      source: PAYPAL_PAYER_SNAPSHOT_SOURCE_CAPTURE,
      orderId: paypalOrderId,
      captureId: paypalCaptureId,
    }),
    buildPayPalPayerCandidate(payer, {
      source: payerSource || PAYPAL_PAYER_SNAPSHOT_SOURCE_ORDER,
      orderId: paypalOrderId,
      captureId: paypalCaptureId,
    }),
    resolveTrustedStoredPayPalPayerCandidate(storedOrderSnapshotContainer, {
      expectedOrderId: paypalOrderId,
      expectedCaptureId: paypalCaptureId,
    }),
    resolveTrustedStoredPayPalPayerCandidate(storedTransactionSnapshotContainer, {
      expectedOrderId: paypalOrderId,
      expectedCaptureId: paypalCaptureId,
    }),
  ]);
}

function mergeTrustedPayPalPayerSnapshot(snapshotContainer, candidate) {
  const nextSnapshot = buildTrustedPayPalPayerSnapshot(candidate);
  if (!nextSnapshot) {
    return snapshotContainer || {};
  }

  return {
    ...(snapshotContainer || {}),
    ...nextSnapshot,
  };
}

function validatePayPalPayerIdentity(payerIdentity) {
  if (!payerIdentity?.email) {
    return {
      ok: false,
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_EMAIL,
      message: "PayPal no entrego payer.email_address en la captura canonica.",
    };
  }

  if (!payerIdentity?.nombre) {
    return {
      ok: false,
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_NAME,
      message: "PayPal no entrego payer.name.given_name en la captura canonica.",
    };
  }

  if (!payerIdentity?.apellido) {
    return {
      ok: false,
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_SURNAME,
      message: "PayPal no entrego payer.name.surname en la captura canonica.",
    };
  }

  return {
    ok: true,
    linkStatus: DONOR_LINK_STATUS_PENDING,
    message: null,
  };
}

function normalizePayPalMoney(money, { label, required = true } = {}) {
  const currencyCode = normalizeCurrency(money?.currency_code || null);
  const rawValue = money?.value;

  if (!currencyCode || rawValue === undefined || rawValue === null || rawValue === "") {
    if (!required) {
      return null;
    }

    throw new Error(`${label} no contiene un monto PayPal valido.`);
  }

  const amountMinorUnits = toMinorUnits(rawValue, currencyCode);

  if (amountMinorUnits < 0) {
    throw new Error(`${label} no puede ser negativo.`);
  }

  return {
    currencyCode,
    amountValue: fromMinorUnits(amountMinorUnits, currencyCode),
    amountMinorUnits,
  };
}

export function resolveOrderIdFromPayPalCapture(paypalCapture) {
  const directOrderId = normalizeNullableString(
    paypalCapture?.supplementary_data?.related_ids?.order_id,
  );

  if (directOrderId) {
    return directOrderId;
  }

  return resolveIdFromPayPalUpLink(paypalCapture?.links, {
    expectedPathPattern: /^\/v2\/checkout\/orders\/([^/]+)$/i,
    label: "capture.links[rel=up]",
  });
}

export function resolveCaptureIdFromPayPalRefund(paypalRefund) {
  const directCaptureId = normalizeNullableString(
    paypalRefund?.supplementary_data?.related_ids?.capture_id,
  );

  if (directCaptureId) {
    return directCaptureId;
  }

  return resolveIdFromPayPalUpLink(paypalRefund?.links, {
    expectedPathPattern: /^\/v2\/payments\/captures\/([^/]+)$/i,
    label: "refund.links[rel=up]",
  });
}

function normalizePayPalRefundBreakdown(sellerPayableBreakdown, {
  label,
  baseAmount,
} = {}) {
  if (!sellerPayableBreakdown || typeof sellerPayableBreakdown !== "object") {
    return null;
  }

  const grossAmount = normalizePayPalMoney(sellerPayableBreakdown.gross_amount, {
    label: `${label}.gross_amount`,
  });
  const feeAmount = normalizePayPalMoney(sellerPayableBreakdown.paypal_fee, {
    label: `${label}.paypal_fee`,
  });
  const netAmount = normalizePayPalMoney(sellerPayableBreakdown.net_amount, {
    label: `${label}.net_amount`,
  });

  if (
    grossAmount.currencyCode !== feeAmount.currencyCode
    || grossAmount.currencyCode !== netAmount.currencyCode
  ) {
    throw new Error(`${label} tiene monedas inconsistentes.`);
  }

  if (baseAmount && grossAmount.currencyCode !== baseAmount.currencyCode) {
    throw new Error(`${label}.gross_amount tiene moneda inconsistente con refund.amount.`);
  }

  if (baseAmount && grossAmount.amountMinorUnits !== baseAmount.amountMinorUnits) {
    throw new Error(`${label}.gross_amount no coincide con refund.amount.`);
  }

  if ((grossAmount.amountMinorUnits - feeAmount.amountMinorUnits) !== netAmount.amountMinorUnits) {
    throw new Error(`${label}.gross_amount - paypal_fee no coincide con net_amount.`);
  }

  return {
    grossAmount: grossAmount.amountValue,
    feeAmount: feeAmount.amountValue,
    netAmount: netAmount.amountValue,
    currencyCode: grossAmount.currencyCode,
    breakdownAvailable: true,
  };
}

export function extractCompletedPayPalCaptureIdFromOrder(paypalOrder) {
  const purchaseUnits = Array.isArray(paypalOrder?.purchase_units)
    ? paypalOrder.purchase_units
    : [];

  for (const purchaseUnit of purchaseUnits) {
    const captures = Array.isArray(purchaseUnit?.payments?.captures)
      ? purchaseUnit.payments.captures
      : [];

    const completedCapture = captures.find(
      (capture) => normalizeCode(capture?.status) === "COMPLETED",
    ) || captures[0];
    const captureId = normalizeNullableString(completedCapture?.id);

    if (captureId) {
      return captureId;
    }
  }

  return null;
}

function extractCaptureOrderContext(paypalOrder) {
  const purchaseUnits = Array.isArray(paypalOrder?.purchase_units)
    ? paypalOrder.purchase_units
    : [];

  const captures = purchaseUnits.flatMap((purchaseUnit) =>
    Array.isArray(purchaseUnit?.payments?.captures)
      ? purchaseUnit.payments.captures
      : [],
  );
  const selectedCapture = captures.find(
    (capture) => normalizeCode(capture?.status) === "COMPLETED",
  ) || captures[0];

  return {
    paypalOrderId: normalizeNullableString(paypalOrder?.id),
    paypalCaptureId: normalizeNullableString(selectedCapture?.id),
    orderStatus: normalizeCode(paypalOrder?.status),
    captureStatus: normalizeCode(selectedCapture?.status),
    payer: pickPayPalPayer(paypalOrder?.payer),
  };
}

export function normalizePayPalCaptureFinancials(paypalCapture) {
  if (!paypalCapture || typeof paypalCapture !== "object" || Array.isArray(paypalCapture)) {
    throw new Error("La captura PayPal canonica debe ser un objeto.");
  }

  const captureStatus = normalizeCode(paypalCapture.status);
  const paypalCaptureId = normalizeNullableString(paypalCapture.id);
  const paypalOrderId = resolveOrderIdFromPayPalCapture(paypalCapture);
  const baseAmount = normalizePayPalMoney(paypalCapture.amount, {
    label: "capture.amount",
  });
  const sellerBreakdown = paypalCapture?.seller_receivable_breakdown;

  if (!paypalCaptureId) {
    throw new Error("La captura PayPal canonica no incluye capture.id.");
  }

  if (sellerBreakdown && typeof sellerBreakdown === "object") {
    const grossAmount = normalizePayPalMoney(sellerBreakdown.gross_amount, {
      label: "seller_receivable_breakdown.gross_amount",
    });
    const feeAmount = normalizePayPalMoney(sellerBreakdown.paypal_fee, {
      label: "seller_receivable_breakdown.paypal_fee",
    });
    const netAmount = normalizePayPalMoney(sellerBreakdown.net_amount, {
      label: "seller_receivable_breakdown.net_amount",
    });

    if (
      grossAmount.currencyCode !== feeAmount.currencyCode
      || grossAmount.currencyCode !== netAmount.currencyCode
      || grossAmount.currencyCode !== baseAmount.currencyCode
    ) {
      throw new Error("La captura PayPal tiene monedas inconsistentes en seller_receivable_breakdown.");
    }

    if (grossAmount.amountMinorUnits !== baseAmount.amountMinorUnits) {
      throw new Error("capture.amount no coincide con seller_receivable_breakdown.gross_amount.");
    }

    if ((grossAmount.amountMinorUnits - feeAmount.amountMinorUnits) !== netAmount.amountMinorUnits) {
      throw new Error("gross_amount - paypal_fee no coincide con net_amount en la captura PayPal.");
    }

    return {
      paypalCaptureId,
      paypalOrderId,
      captureStatus,
      currencyCode: grossAmount.currencyCode,
      grossAmount: grossAmount.amountValue,
      feeAmount: feeAmount.amountValue,
      netAmount: netAmount.amountValue,
      hasSellerReceivableBreakdown: true,
      financialSource: "seller_receivable_breakdown",
      createTime: paypalCapture.create_time || null,
      updateTime: paypalCapture.update_time || null,
    };
  }

  return {
    paypalCaptureId,
    paypalOrderId,
    captureStatus,
    currencyCode: baseAmount.currencyCode,
    grossAmount: baseAmount.amountValue,
    feeAmount: 0,
    netAmount: baseAmount.amountValue,
    hasSellerReceivableBreakdown: false,
    financialSource: "capture_amount_fallback",
    createTime: paypalCapture.create_time || null,
    updateTime: paypalCapture.update_time || null,
  };
}

export function normalizePayPalRefundFinancials(paypalRefund, {
  signedWebhookRefundResource = null,
  signedWebhookEventType = null,
} = {}) {
  if (!paypalRefund || typeof paypalRefund !== "object" || Array.isArray(paypalRefund)) {
    throw new Error("El reembolso PayPal canonico debe ser un objeto.");
  }

  const refundAmount = normalizePayPalMoney(paypalRefund.amount, {
    label: "refund.amount",
  });
  const paypalRefundId = normalizeNullableString(paypalRefund.id);

  if (!paypalRefundId) {
    throw new Error("El reembolso PayPal no incluye refund.id.");
  }

  const canonicalBreakdown = normalizePayPalRefundBreakdown(
    paypalRefund.seller_payable_breakdown,
    {
      label: "seller_payable_breakdown",
      baseAmount: refundAmount,
    },
  );
  let resolvedBreakdown = canonicalBreakdown;
  let refundBreakdownSource = canonicalBreakdown ? "PAYPAL_CANONICAL" : null;

  if (!resolvedBreakdown && signedWebhookRefundResource) {
    if (normalizeCode(signedWebhookEventType) !== "PAYMENT.CAPTURE.REFUNDED") {
      throw new Error("El breakdown del webhook firmado no corresponde a PAYMENT.CAPTURE.REFUNDED.");
    }

    const signedRefundId = normalizeNullableString(signedWebhookRefundResource.id);
    if (signedRefundId !== paypalRefundId) {
      throw new Error("El webhook firmado no corresponde al mismo refund PayPal canonico.");
    }

    const signedRefundStatus = normalizeCode(signedWebhookRefundResource.status);
    if (signedRefundStatus && signedRefundStatus !== normalizeCode(paypalRefund.status)) {
      throw new Error("El webhook firmado tiene un estado incompatible con el refund PayPal canonico.");
    }

    resolvedBreakdown = normalizePayPalRefundBreakdown(
      signedWebhookRefundResource.seller_payable_breakdown,
      {
        label: "signed_webhook.seller_payable_breakdown",
        baseAmount: refundAmount,
      },
    );
    refundBreakdownSource = resolvedBreakdown ? "SIGNED_WEBHOOK" : null;
  }

  if (!resolvedBreakdown) {
    throw new Error(
      "PAYPAL_REFUND_BREAKDOWN_UNAVAILABLE: PayPal no entrego seller_payable_breakdown para conciliar el refund.",
    );
  }

  return {
    paypalRefundId,
    paypalCaptureId: resolveCaptureIdFromPayPalRefund(paypalRefund),
    paypalOrderId: normalizeNullableString(
      paypalRefund?.supplementary_data?.related_ids?.order_id,
    ),
    refundStatus: normalizeCode(paypalRefund.status),
    currencyCode: resolvedBreakdown.currencyCode,
    grossAmount: resolvedBreakdown.grossAmount,
    feeAmount: resolvedBreakdown.feeAmount,
    netAmount: resolvedBreakdown.netAmount,
    breakdownAvailable: true,
    refundBreakdownSource,
    createTime: paypalRefund.create_time || null,
    updateTime: paypalRefund.update_time || null,
  };
}

export function normalizePayPalReversalSnapshot({
  webhookEvent,
  canonicalCapture,
}) {
  const captureFinancials = normalizePayPalCaptureFinancials(canonicalCapture);
  const webhookEventId = normalizeNullableString(webhookEvent?.id);
  const reversalAmount = normalizePayPalMoney(webhookEvent?.resource?.amount, {
    label: "webhook.resource.amount",
    required: false,
  });

  if (!webhookEventId) {
    throw new Error("La reversa PayPal requiere webhookEvent.id.");
  }

  if (reversalAmount && reversalAmount.currencyCode !== captureFinancials.currencyCode) {
    throw new Error("La reversa PayPal tiene una moneda inconsistente respecto de la captura.");
  }

  if (
    reversalAmount
    && !areAmountsEquivalent(
      reversalAmount.amountValue,
      captureFinancials.grossAmount,
      captureFinancials.currencyCode,
    )
  ) {
    throw new Error("La reversa PayPal no coincide con el monto canonico de la captura original.");
  }

  return {
    reversalFactId: webhookEventId,
    webhookEventId,
    providerReversalId: normalizeNullableString(webhookEvent?.resource?.id),
    paypalCaptureId: captureFinancials.paypalCaptureId,
    paypalOrderId: captureFinancials.paypalOrderId,
    currencyCode: captureFinancials.currencyCode,
    grossAmount: captureFinancials.grossAmount,
    createTime: webhookEvent?.create_time || captureFinancials.updateTime || captureFinancials.createTime,
    captureFinancials,
  };
}

function assertDonationPaymentOrder(paymentOrder) {
  if (!paymentOrder) {
    throw buildServiceError("Orden de pago no encontrada.", 404);
  }

  if (paymentOrder.proposito !== DONATION_CATEGORY_KEY) {
    throw buildServiceError("La orden de pago no corresponde a donacion unica.", 400);
  }
}

async function getPaymentOrderWithRelations(executor, where) {
  return executor.getRepository(PaymentOrder).findOne({
    where,
    relations: {
      payment_provider: true,
      donor: true,
      transactions: true,
    },
  });
}

async function getTransactionWithRelations(executor, where) {
  return executor.getRepository(Transaction).findOne({
    where,
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
    order: {
      transaccion_id: "DESC",
    },
  });
}

async function getTransactionsWithRelations(executor, where) {
  return executor.getRepository(Transaction).find({
    where,
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
    order: {
      transaccion_id: "DESC",
    },
  });
}

async function updatePaymentOrderAsFailed(manager, order, reason, nextMetadata = null) {
  if (!order || order.estado === PAYMENT_ORDER_CAPTURED_STATE) {
    return order;
  }

  order.estado = PAYMENT_ORDER_FAILED_STATE;
  order.metadata = mergeOrderMetadata(order, {
    paypal: {
      ...(order.metadata?.paypal || {}),
      order_id: order.proveedor_orden_id,
      last_error: normalizeNullableString(reason),
      updated_at: toIsoTimestamp(new Date()),
      ...(nextMetadata || {}),
    },
  });

  await manager.getRepository(PaymentOrder).save(order);
  return order;
}

function sanitizeDonorLinkErrorMessage(error) {
  const normalizedMessage = normalizeNullableString(error?.message);

  if (!normalizedMessage) {
    return "No fue posible asociar el donante a la donacion confirmada.";
  }

  if (/duplicate|unique|constraint|sql|query|23505/i.test(normalizedMessage)) {
    return "No fue posible asociar el donante a la donacion confirmada.";
  }

  return normalizedMessage;
}

function classifyDonorLinkFailure(error) {
  const rawMessage = normalizeNullableString(error?.message) || "";

  if (/payer\.email_address/i.test(rawMessage)) {
    return {
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_EMAIL,
      errorCode: DONOR_LINK_STATUS_MISSING_PAYER_EMAIL,
    };
  }

  if (/payer\.name\.given_name/i.test(rawMessage)) {
    return {
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_NAME,
      errorCode: DONOR_LINK_STATUS_MISSING_PAYER_NAME,
    };
  }

  if (/payer\.name\.surname/i.test(rawMessage)) {
    return {
      linkStatus: DONOR_LINK_STATUS_MISSING_PAYER_SURNAME,
      errorCode: DONOR_LINK_STATUS_MISSING_PAYER_SURNAME,
    };
  }

  if (
    ["23502", "42703", "42P01"].includes(String(error?.code || ""))
    || /null value in column|violates not-null constraint|column .* does not exist|relation .* does not exist/i.test(rawMessage)
  ) {
    return {
      linkStatus: DONOR_LINK_STATUS_ERROR,
      errorCode: "DONOR_SCHEMA_CONSTRAINT_MISMATCH",
    };
  }

  if (/apuntan a donantes distintos/i.test(rawMessage)) {
    return {
      linkStatus: DONOR_LINK_STATUS_ERROR,
      errorCode: "DONOR_RELATION_MISMATCH",
    };
  }

  return {
    linkStatus: DONOR_LINK_STATUS_ERROR,
    errorCode: "DONOR_LINK_FAILED",
  };
}

async function resolveExistingDonorByEmail(executor, email) {
  if (!email) return null;
  return executor.getRepository(Donor).findOne({
    where: { email },
  });
}

async function createDonorForConfirmedDonation(manager, donorPublicData) {
  const repository = manager.getRepository(Donor);
  const donorByEmail = await resolveExistingDonorByEmail(manager, donorPublicData.email);

  if (donorByEmail) {
    return assertExistingDonorIsLinkable(donorByEmail);
  }

  const normalizedDonorIdentity = normalizeDonorIdentityForPersistence(donorPublicData, {
    statusCode: 409,
  });

  return repository.save(
    repository.create({
      nombre: normalizedDonorIdentity.nombre,
      apellido: normalizedDonorIdentity.apellido,
      email: normalizedDonorIdentity.email,
      telefono: null,
      usuario_instagram: null,
    }),
  );
}

async function resolveOrCreateDonorForConfirmedDonation(donorInput) {
  const donorPublicData = normalizePublicDonorData(donorInput);
  if (!donorPublicData?.email) return null;

  const existingDonor = await resolveExistingDonorByEmail(AppDataSource.manager, donorPublicData.email);
  if (existingDonor) {
    return assertExistingDonorIsLinkable(existingDonor);
  }

  try {
    return await AppDataSource.transaction(async (manager) =>
      createDonorForConfirmedDonation(manager, donorPublicData));
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const recoveredDonor = await resolveExistingDonorByEmail(AppDataSource.manager, donorPublicData.email);
    if (recoveredDonor) {
      return assertExistingDonorIsLinkable(recoveredDonor);
    }

    throw buildServiceError(
      "No fue posible recuperar el donante existente tras una carrera de identidad.",
      409,
    );
  }
}

async function persistDonationIdentityState(manager, {
  paymentOrderId,
  captureTransactionId = null,
  donor = null,
  metadata,
}) {
  const paymentOrderRepository = manager.getRepository(PaymentOrder);
  const transactionRepository = manager.getRepository(Transaction);

  await paymentOrderRepository.save({
    orden_pago_id: Number(paymentOrderId),
    donor: donor ? { donante_id: Number(donor.donante_id) } : null,
    metadata,
  });

  if (captureTransactionId) {
    await transactionRepository.save({
      transaccion_id: Number(captureTransactionId),
      donor: donor ? { donante_id: Number(donor.donante_id) } : null,
    });
  }
}

function resolveLinkedDonorCandidate(paymentOrder, captureTransaction) {
  if (
    paymentOrder?.donor?.donante_id
    && captureTransaction?.donor?.donante_id
    && Number(paymentOrder.donor.donante_id) !== Number(captureTransaction.donor.donante_id)
  ) {
    throw buildServiceError(
      "La orden de pago y la transaccion original apuntan a donantes distintos.",
      409,
    );
  }

  return paymentOrder?.donor || captureTransaction?.donor || null;
}

async function resolveCaptureTransactionForDonationLink(manager, paymentOrder, captureTransactionId = null) {
  if (captureTransactionId) {
    return getTransactionWithRelations(manager, {
      transaccion_id: Number(captureTransactionId),
    });
  }

  return findExistingDonationCaptureTransaction(manager, {
    ordenPagoId: paymentOrder?.orden_pago_id || null,
    paypalOrderId: paymentOrder?.proveedor_orden_id || null,
    paypalCaptureId: normalizeNullableString(paymentOrder?.metadata?.paypal?.capture_id),
    currencyCode: paymentOrder?.moneda || null,
    grossAmount: paymentOrder?.monto_bruto ?? null,
  });
}

async function resolveCanonicalCaptureForDonationLink({
  paymentOrder,
  captureTransaction,
  capture = null,
  getCanonicalCapture = getPayPalCapture,
}) {
  if (capture) {
    return capture;
  }

  const captureId = normalizeNullableString(
    captureTransaction?.referencia_externa
      || paymentOrder?.metadata?.paypal?.capture_id
      || paymentOrder?.metadata?.paypal?.last_capture_id,
  );

  if (!captureId) {
    throw buildServiceError(
      "No fue posible resolver capture_id para asociar el donante PayPal.",
      409,
    );
  }

  return getCanonicalCapture(captureId);
}

async function resolvePayPalPayerIdentityForDonationLink({
  paymentOrder,
  captureTransaction,
  capture = null,
  payer = null,
  payerSource = null,
  getCanonicalCapture = getPayPalCapture,
  getCanonicalOrder = getPayPalOrder,
}) {
  const canonicalCapture = await resolveCanonicalCaptureForDonationLink({
    paymentOrder,
    captureTransaction,
    capture,
    getCanonicalCapture,
  });
  const paypalOrderId = normalizeNullableString(
    paymentOrder?.proveedor_orden_id
      || canonicalCapture?.supplementary_data?.related_ids?.order_id
      || captureTransaction?.metadata?.paypal_order_id,
  );
  const paypalCaptureId = normalizeNullableString(
    canonicalCapture?.id
      || captureTransaction?.referencia_externa
      || paymentOrder?.metadata?.paypal?.capture_id,
  );

  let canonicalOrderPayerIdentity = null;
  const shouldFetchOrderPayer = !hasCompleteDonorIdentity(
    pickBestPayPalPayerCandidate([
      resolvePreferredTrustedPayPalPayerCandidate({
        capture: canonicalCapture,
        payer,
        payerSource,
        storedOrderSnapshotContainer: paymentOrder?.metadata?.paypal,
        storedTransactionSnapshotContainer: captureTransaction?.metadata,
        paypalOrderId,
        paypalCaptureId,
      }),
    ])?.identity,
  );

  if (shouldFetchOrderPayer) {
    if (paypalOrderId) {
      const canonicalOrder = await getCanonicalOrder(paypalOrderId);
      canonicalOrderPayerIdentity = pickPayPalPayer(canonicalOrder?.payer);
    }
  }

  return pickBestPayPalPayerIdentity([
    resolvePreferredTrustedPayPalPayerCandidate({
      capture: canonicalCapture,
      payer,
      payerSource,
      storedOrderSnapshotContainer: paymentOrder?.metadata?.paypal,
      storedTransactionSnapshotContainer: captureTransaction?.metadata,
      paypalOrderId,
      paypalCaptureId,
    })?.identity,
    buildPayPalPayerCandidate(canonicalOrderPayerIdentity, {
      source: PAYPAL_PAYER_SNAPSHOT_SOURCE_ORDER,
      orderId: paypalOrderId,
      captureId: paypalCaptureId,
    })?.identity,
  ]);
}

export async function linkDonorToConfirmedPayPalDonation({
  paymentOrderId,
  captureTransactionId = null,
  capture = null,
  payer = null,
  payerSource = null,
  getCanonicalCapture = getPayPalCapture,
  getCanonicalOrder = getPayPalOrder,
} = {}) {
  if (!paymentOrderId) {
    throw buildServiceError("paymentOrderId es obligatorio para asociar el donante.", 400);
  }

  return AppDataSource.transaction(async (manager) => {
    const paymentOrder = await getPaymentOrderWithRelations(manager, {
      orden_pago_id: Number(paymentOrderId),
    });

    assertDonationPaymentOrder(paymentOrder);

    if (paymentOrder.estado !== PAYMENT_ORDER_CAPTURED_STATE) {
      return {
        linked: false,
        anonymous: isDonationMarkedAsAnonymous(paymentOrder.metadata),
        paymentOrder,
        transaction: null,
      };
    }

    const captureTransaction = await resolveCaptureTransactionForDonationLink(
      manager,
      paymentOrder,
      captureTransactionId,
    );
    const attemptedAt = toIsoTimestamp(new Date());
    const identityMode = getDonationIdentityMode(paymentOrder.metadata);

    if (identityMode !== DONOR_IDENTITY_MODE_IDENTIFIED) {
      const metadata = buildDonationIdentityMetadata(paymentOrder.metadata, {
        identityMode,
        linkStatus: DONOR_LINK_STATUS_NOT_APPLICABLE,
        donorPublicData: null,
        consentimientoDatos: false,
        donorId: null,
        identitySource: null,
        linkError: null,
        linkErrorCode: null,
        attemptedAt,
        linkedAt: null,
      });

      await persistDonationIdentityState(manager, {
        paymentOrderId,
        captureTransactionId: captureTransaction?.transaccion_id || null,
        donor: null,
        metadata,
      });

      return {
        linked: false,
        anonymous: identityMode === DONOR_IDENTITY_MODE_ANONYMOUS,
        paymentOrder: await getPaymentOrderWithRelations(manager, {
          orden_pago_id: Number(paymentOrderId),
        }),
        transaction: captureTransaction?.transaccion_id
          ? await getTransactionWithRelations(manager, {
              transaccion_id: Number(captureTransaction.transaccion_id),
            })
          : null,
      };
    }

    const resolvedExistingDonor = resolveLinkedDonorCandidate(paymentOrder, captureTransaction);
    if (resolvedExistingDonor?.donante_id) {
      const metadata = buildDonationIdentityMetadata(paymentOrder.metadata, {
        identityMode: DONOR_IDENTITY_MODE_IDENTIFIED,
        linkStatus: DONOR_LINK_STATUS_LINKED,
        donorPublicData: null,
        consentimientoDatos: false,
        donorId: resolvedExistingDonor.donante_id,
        identitySource: DONOR_IDENTITY_SOURCE_PAYPAL_PAYER,
        linkError: null,
        linkErrorCode: null,
        attemptedAt,
        linkedAt: paymentOrder.metadata?.donor_linked_at || attemptedAt,
      });

      await persistDonationIdentityState(manager, {
        paymentOrderId,
        captureTransactionId: captureTransaction?.transaccion_id || null,
        donor: resolvedExistingDonor,
        metadata,
      });

      const linkedPaymentOrder = await getPaymentOrderWithRelations(manager, {
        orden_pago_id: Number(paymentOrderId),
      });
      const linkedTransaction = captureTransaction?.transaccion_id
        ? await getTransactionWithRelations(manager, {
            transaccion_id: Number(captureTransaction.transaccion_id),
          })
        : null;

      if (!isDonationDonorFullyLinked(linkedPaymentOrder, linkedTransaction)) {
        throw buildServiceError(
          "No fue posible confirmar la asociacion persistida del donante PayPal.",
          409,
        );
      }

      return {
        linked: true,
        anonymous: false,
        paymentOrder: linkedPaymentOrder,
        transaction: linkedTransaction,
      };
    }

    const payerIdentity = await resolvePayPalPayerIdentityForDonationLink({
      paymentOrder,
      captureTransaction,
      capture,
      payer,
      payerSource,
      getCanonicalCapture,
      getCanonicalOrder,
    });
    const payerIdentityValidation = validatePayPalPayerIdentity(payerIdentity);

    if (!payerIdentityValidation.ok) {
      throw buildServiceError(payerIdentityValidation.message, 409);
    }

    const donor = await resolveOrCreateDonorForConfirmedDonation(payerIdentity);

    if (!donor?.donante_id) {
      throw buildServiceError("No fue posible resolver el donante confirmado.", 409);
    }

    const metadata = buildDonationIdentityMetadata(paymentOrder.metadata, {
      identityMode: DONOR_IDENTITY_MODE_IDENTIFIED,
      linkStatus: DONOR_LINK_STATUS_LINKED,
      donorPublicData: null,
      consentimientoDatos: false,
      donorId: donor.donante_id,
      identitySource: DONOR_IDENTITY_SOURCE_PAYPAL_PAYER,
      linkError: null,
      linkErrorCode: null,
      attemptedAt,
      linkedAt: attemptedAt,
    });

    await persistDonationIdentityState(manager, {
      paymentOrderId,
      captureTransactionId: captureTransaction?.transaccion_id || null,
      donor,
      metadata,
    });

    const linkedPaymentOrder = await getPaymentOrderWithRelations(manager, {
      orden_pago_id: Number(paymentOrderId),
    });
    const linkedTransaction = captureTransaction?.transaccion_id
      ? await getTransactionWithRelations(manager, {
          transaccion_id: Number(captureTransaction.transaccion_id),
        })
      : null;

    if (!isDonationDonorFullyLinked(linkedPaymentOrder, linkedTransaction)) {
      throw buildServiceError(
        "No fue posible confirmar la asociacion persistida del donante PayPal.",
        409,
      );
    }

    return {
      linked: true,
      anonymous: false,
      paymentOrder: linkedPaymentOrder,
      transaction: linkedTransaction,
    };
  });
}

async function attemptNonBlockingDonationDonorLink({
  paymentOrderId,
  captureTransactionId = null,
  capture = null,
  payer = null,
  payerSource = null,
  getCanonicalCapture = getPayPalCapture,
  getCanonicalOrder = getPayPalOrder,
}) {
  try {
    return await linkDonorToConfirmedPayPalDonation({
      paymentOrderId,
      captureTransactionId,
      capture,
      payer,
      payerSource,
      getCanonicalCapture,
      getCanonicalOrder,
    });
  } catch (error) {
    const sanitizedError = sanitizeDonorLinkErrorMessage(error);
    const classifiedError = classifyDonorLinkFailure(error);
    const attemptedAt = toIsoTimestamp(new Date());

    await AppDataSource.transaction(async (manager) => {
      const paymentOrder = await getPaymentOrderWithRelations(manager, {
        orden_pago_id: Number(paymentOrderId),
      });

      if (!paymentOrder) {
        return;
      }

      const captureTransaction = await resolveCaptureTransactionForDonationLink(
        manager,
        paymentOrder,
        captureTransactionId,
      );
      const identityMode = getDonationIdentityMode(paymentOrder.metadata);
      const nextLinkStatus = identityMode === DONOR_IDENTITY_MODE_IDENTIFIED
        ? classifiedError.linkStatus
        : DONOR_LINK_STATUS_NOT_APPLICABLE;
      const metadata = buildDonationIdentityMetadata(paymentOrder.metadata, {
        identityMode,
        linkStatus: nextLinkStatus,
        donorPublicData: normalizePublicDonorData(paymentOrder.metadata?.donor_public_data),
        consentimientoDatos: false,
        donorId: paymentOrder.donor?.donante_id || captureTransaction?.donor?.donante_id || null,
        identitySource: identityMode === DONOR_IDENTITY_MODE_IDENTIFIED
          ? DONOR_IDENTITY_SOURCE_PAYPAL_PAYER
          : null,
        linkError: identityMode === DONOR_IDENTITY_MODE_IDENTIFIED ? sanitizedError : null,
        linkErrorCode: identityMode === DONOR_IDENTITY_MODE_IDENTIFIED ? classifiedError.errorCode : null,
        attemptedAt,
        linkedAt: paymentOrder.metadata?.donor_linked_at || null,
      });

      await persistDonationIdentityState(manager, {
        paymentOrderId,
        captureTransactionId: captureTransaction?.transaccion_id || null,
        donor: paymentOrder.donor || captureTransaction?.donor || null,
        metadata,
      });
    });

    return {
      linked: false,
      anonymous: false,
      error: sanitizedError,
    };
  }
}

async function findPaymentOrderForCapture({ orden_pago_id, paypal_order_id }) {
  if (orden_pago_id) {
    const orderById = await getPaymentOrderWithRelations(AppDataSource.manager, {
      orden_pago_id: Number(orden_pago_id),
    });

    if (orderById) {
      if (
        paypal_order_id
        && orderById.proveedor_orden_id
        && orderById.proveedor_orden_id !== paypal_order_id
      ) {
        throw new Error("paypal_order_id no coincide con la orden_pago_id enviada.");
      }

      return orderById;
    }
  }

  if (!paypal_order_id) {
    throw new Error("Orden de pago no encontrada.");
  }

  const orderByProvider = await getPaymentOrderWithRelations(AppDataSource.manager, {
    proveedor_orden_id: paypal_order_id,
  });

  if (!orderByProvider) {
    throw new Error("Orden de pago no encontrada.");
  }

  return orderByProvider;
}

function assertOriginalDonationCaptureTransactionMatch(transaction, {
  idempotencyKey,
  paypalCaptureId,
  ordenPagoId = null,
  paypalOrderId = null,
  currencyCode = null,
  grossAmount = null,
} = {}) {
  if (!transaction) {
    return null;
  }

  if (transaction.tipo !== "INGRESO") {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal no es un INGRESO valido.",
      409,
    );
  }

  if (transaction.category?.clave !== DONATION_CATEGORY_KEY) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal no corresponde a DONACION_UNICA.",
      409,
    );
  }

  if (transaction.payment_provider?.clave !== PAYPAL_PROVIDER_KEY) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal no corresponde al proveedor PAYPAL.",
      409,
    );
  }

  if (
    idempotencyKey
    && normalizeNullableString(transaction.idempotencia_key) !== normalizeNullableString(idempotencyKey)
  ) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal tiene una idempotencia inconsistente.",
      409,
    );
  }

  if (
    paypalCaptureId
    && normalizeNullableString(transaction.referencia_externa) !== normalizeNullableString(paypalCaptureId)
  ) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal tiene un capture_id inconsistente.",
      409,
    );
  }

  if (
    ordenPagoId
    && Number(transaction.payment_order?.orden_pago_id || 0) !== Number(ordenPagoId)
  ) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal apunta a otra orden local.",
      409,
    );
  }

  if (currencyCode && transaction.moneda !== currencyCode) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal tiene moneda inconsistente.",
      409,
    );
  }

  if (
    grossAmount !== null
    && grossAmount !== undefined
    && !areAmountsEquivalent(transaction.monto_bruto, grossAmount, transaction.moneda || currencyCode)
  ) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal tiene monto_bruto inconsistente.",
      409,
    );
  }

  const existingPayPalOrderId = normalizeNullableString(transaction.metadata?.paypal_order_id);
  if (existingPayPalOrderId && paypalOrderId && existingPayPalOrderId !== paypalOrderId) {
    throw buildServiceError(
      "La transaccion original localizada para la captura PayPal tiene un paypal_order_id inconsistente.",
      409,
    );
  }

  return transaction;
}

async function findExistingDonationCaptureTransaction(executor, {
  idempotencyKey,
  paypalCaptureId,
  ordenPagoId,
  paypalOrderId = null,
  currencyCode = null,
  grossAmount = null,
}) {
  if (idempotencyKey) {
    const transactionByIdempotency = await getTransactionWithRelations(executor, {
      idempotencia_key: idempotencyKey,
    });

    if (transactionByIdempotency) {
      return assertOriginalDonationCaptureTransactionMatch(transactionByIdempotency, {
        idempotencyKey,
        paypalCaptureId,
        ordenPagoId,
        paypalOrderId,
        currencyCode,
        grossAmount,
      });
    }
  }

  if (paypalCaptureId) {
    const transactionByCaptureId = await getTransactionWithRelations(executor, {
      referencia_externa: paypalCaptureId,
    });

    if (transactionByCaptureId) {
      return assertOriginalDonationCaptureTransactionMatch(transactionByCaptureId, {
        idempotencyKey,
        paypalCaptureId,
        ordenPagoId,
        paypalOrderId,
        currencyCode,
        grossAmount,
      });
    }
  }

  if (!ordenPagoId) {
    return null;
  }

  const transactions = await getTransactionsWithRelations(executor, {
    payment_order: { orden_pago_id: Number(ordenPagoId) },
    tipo: "INGRESO",
    estado: In(CONFIRMED_TRANSACTION_STATES),
  });

  const matchingTransaction = transactions.find((transaction) =>
    transaction.category?.clave === DONATION_CATEGORY_KEY
    && transaction.payment_provider?.clave === PAYPAL_PROVIDER_KEY,
  ) || null;

  return assertOriginalDonationCaptureTransactionMatch(matchingTransaction, {
    idempotencyKey,
    paypalCaptureId,
    ordenPagoId,
    paypalOrderId,
    currencyCode,
    grossAmount,
  });
}

function assertCompensationTransactionMatch(transaction, {
  idempotencyKey,
  categoryKey,
  adjustmentType,
  currencyCode = null,
  grossAmount = null,
  requireMatchingIdempotency = false,
}) {
  if (!transaction) {
    return null;
  }

  if (transaction.tipo !== "EGRESO") {
    throw buildServiceError(
      "Existe una transaccion con la misma referencia externa, pero no corresponde a una compensacion EGRESO valida.",
      409,
    );
  }

  if (transaction.category?.clave !== categoryKey) {
    throw buildServiceError(
      "Existe una transaccion con la misma referencia externa, pero pertenece a otra categoria contable.",
      409,
    );
  }

  if (transaction.payment_provider?.clave !== PAYPAL_PROVIDER_KEY) {
    throw buildServiceError(
      "Existe una transaccion con la misma referencia externa, pero no corresponde al proveedor PAYPAL.",
      409,
    );
  }

  if (
    transaction.metadata?.adjustment_type
    && transaction.metadata.adjustment_type !== adjustmentType
  ) {
    throw buildServiceError(
      "Existe una transaccion con la misma referencia externa, pero con un adjustment_type incompatible.",
      409,
    );
  }

  if (
    requireMatchingIdempotency
    && normalizeNullableString(transaction.idempotencia_key) !== normalizeNullableString(idempotencyKey)
  ) {
    throw buildServiceError(
      "Existe una transaccion con la misma referencia externa, pero no corresponde a la compensacion esperada.",
      409,
    );
  }

  if (currencyCode && transaction.moneda !== currencyCode) {
    throw buildServiceError(
      "La transaccion compensatoria existente tiene moneda inconsistente.",
      409,
    );
  }

  if (
    grossAmount !== null
    && grossAmount !== undefined
    && !areAmountsEquivalent(transaction.monto_bruto, grossAmount, transaction.moneda || currencyCode)
  ) {
    throw buildServiceError(
      "La transaccion compensatoria existente tiene monto_bruto inconsistente.",
      409,
    );
  }

  return transaction;
}

async function findExistingCompensationTransaction(executor, {
  idempotencyKey,
  referenciaExterna,
  categoryKey,
  adjustmentType,
  currencyCode = null,
  grossAmount = null,
}) {
  if (idempotencyKey) {
    const transactionByIdempotency = await getTransactionWithRelations(executor, {
      idempotencia_key: idempotencyKey,
    });

    if (transactionByIdempotency) {
      return assertCompensationTransactionMatch(transactionByIdempotency, {
        idempotencyKey,
        categoryKey,
        adjustmentType,
        currencyCode,
        grossAmount,
      });
    }
  }

  if (!referenciaExterna) {
    return null;
  }

  const transactionByReference = await getTransactionWithRelations(executor, {
    referencia_externa: referenciaExterna,
  });

  if (!transactionByReference) {
    return null;
  }

  return assertCompensationTransactionMatch(transactionByReference, {
    idempotencyKey,
    categoryKey,
    adjustmentType,
    currencyCode,
    grossAmount,
    requireMatchingIdempotency: true,
  });
}

async function resolvePayPalDependencies(manager, categoryKey) {
  const [paymentProvider, category] = await Promise.all([
    getPaymentProviderByKeyOrThrow(manager, PAYPAL_PROVIDER_KEY, { onlyActive: true }),
    getTransactionCategoryByKeyOrThrow(manager, categoryKey, { onlyActive: true }),
  ]);

  return { paymentProvider, category };
}

async function buildCaptureResponse({
  paymentOrder,
  transaction,
  paypalOrderId,
  paypalCaptureId,
  paypalRefundId = null,
  status,
  idempotente,
  source,
}) {
  const refreshedOrder = paymentOrder?.orden_pago_id
    ? await getPaymentOrderWithRelations(AppDataSource.manager, {
        orden_pago_id: paymentOrder.orden_pago_id,
      })
    : null;
  const refreshedTransaction = transaction?.transaccion_id
    ? await getTransactionWithRelations(AppDataSource.manager, {
        transaccion_id: transaction.transaccion_id,
      })
    : null;

  return {
    orden_pago: mapPaymentOrder(refreshedOrder || paymentOrder),
    transaccion: mapTransaction(refreshedTransaction || transaction),
    paypal_order_id: paypalOrderId,
    paypal_capture_id: paypalCaptureId || refreshedTransaction?.referencia_externa || null,
    paypal_refund_id: paypalRefundId,
    status: status || (refreshedOrder || paymentOrder)?.estado || PAYMENT_ORDER_CAPTURED_STATE,
    idempotente,
    source,
  };
}

function buildCaptureFinancialMetadata(captureFinancials) {
  return {
    gross_amount: captureFinancials.grossAmount,
    paypal_fee: captureFinancials.feeAmount,
    net_amount: captureFinancials.netAmount,
    currency_code: captureFinancials.currencyCode,
    source: captureFinancials.financialSource,
    has_seller_receivable_breakdown: captureFinancials.hasSellerReceivableBreakdown,
  };
}

export function planCaptureTransactionReconciliation(existingTransaction, {
  paymentOrderId,
  paypalOrderId,
  captureFinancials,
}) {
  if (!existingTransaction) {
    return {
      requiresEnrichment: false,
    };
  }

  const existingPaymentOrderId = Number(existingTransaction.payment_order?.orden_pago_id || 0);
  if (paymentOrderId && existingPaymentOrderId && existingPaymentOrderId !== Number(paymentOrderId)) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal apunta a otra orden de pago.",
      409,
    );
  }

  if (
    existingTransaction.referencia_externa
    && existingTransaction.referencia_externa !== captureFinancials.paypalCaptureId
  ) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal tiene un capture_id distinto.",
      409,
    );
  }

  const existingPayPalOrderId = normalizeNullableString(existingTransaction.metadata?.paypal_order_id);
  if (existingPayPalOrderId && paypalOrderId && existingPayPalOrderId !== paypalOrderId) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal tiene un paypal_order_id distinto.",
      409,
    );
  }

  if (!areAmountsEquivalent(
    existingTransaction.monto_bruto,
    captureFinancials.grossAmount,
    captureFinancials.currencyCode,
  )) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal tiene monto_bruto inconsistente con PayPal.",
      409,
    );
  }

  if (existingTransaction.moneda !== captureFinancials.currencyCode) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal tiene moneda inconsistente con PayPal.",
      409,
    );
  }

  const existingFee = normalizeStoredMoney(
    existingTransaction.monto_fee || 0,
    captureFinancials.currencyCode,
  );
  const existingNet = normalizeStoredMoney(
    existingTransaction.monto_neto || 0,
    captureFinancials.currencyCode,
  );
  const needsLegacyEnrichment = captureFinancials.hasSellerReceivableBreakdown
    && areAmountsEquivalent(existingFee, 0, captureFinancials.currencyCode)
    && areAmountsEquivalent(
      existingNet,
      existingTransaction.monto_bruto,
      captureFinancials.currencyCode,
    );
  const alreadyCanonical = areAmountsEquivalent(
    existingFee,
    captureFinancials.feeAmount,
    captureFinancials.currencyCode,
  )
    && areAmountsEquivalent(
      existingNet,
      captureFinancials.netAmount,
      captureFinancials.currencyCode,
    );

  if (
    captureFinancials.hasSellerReceivableBreakdown
    && !needsLegacyEnrichment
    && !alreadyCanonical
  ) {
    throw buildServiceError(
      "La transaccion existente del capture PayPal tiene fee/net distintos de la captura canonica.",
      409,
    );
  }

  return {
    requiresEnrichment: needsLegacyEnrichment && !alreadyCanonical,
  };
}

async function synchronizeCapturedPaymentOrderAndTransaction(manager, {
  paymentOrderId,
  captureTransactionId = null,
  captureFinancials,
  capture = null,
  payer,
  payerSource = null,
  source,
}) {
  const paymentOrder = await getPaymentOrderWithRelations(manager, {
    orden_pago_id: Number(paymentOrderId),
  });

  assertDonationPaymentOrder(paymentOrder);

  const nextPayerSnapshotCandidate = resolvePreferredTrustedPayPalPayerCandidate({
    capture,
    payer,
    payerSource,
    storedOrderSnapshotContainer: paymentOrder.metadata?.paypal,
    paypalOrderId: paymentOrder.proveedor_orden_id,
    paypalCaptureId: captureFinancials.paypalCaptureId,
  });

  paymentOrder.estado = PAYMENT_ORDER_CAPTURED_STATE;
  paymentOrder.moneda = captureFinancials.currencyCode;
  paymentOrder.monto_bruto = captureFinancials.grossAmount;
  paymentOrder.capturada_en = captureFinancials.updateTime
    ? new Date(captureFinancials.updateTime)
    : new Date();
  paymentOrder.metadata = mergeOrderMetadata(paymentOrder, {
    paypal: {
      ...(paymentOrder.metadata?.paypal || {}),
      order_id: paymentOrder.proveedor_orden_id,
      capture_id: captureFinancials.paypalCaptureId,
      order_status: "COMPLETED",
      capture_status: captureFinancials.captureStatus,
      create_time: captureFinancials.createTime,
      update_time: captureFinancials.updateTime,
      capture_financials: buildCaptureFinancialMetadata(captureFinancials),
      ...mergeTrustedPayPalPayerSnapshot(paymentOrder.metadata?.paypal, nextPayerSnapshotCandidate),
    },
    last_reconciled_from: source,
  });

  await manager.getRepository(PaymentOrder).save(paymentOrder);

  let captureTransaction = null;
  if (captureTransactionId) {
    captureTransaction = await getTransactionWithRelations(manager, {
      transaccion_id: Number(captureTransactionId),
    });

    const reconciliationPlan = planCaptureTransactionReconciliation(captureTransaction, {
      paymentOrderId,
      paypalOrderId: paymentOrder.proveedor_orden_id,
      captureFinancials,
    });

    if (reconciliationPlan.requiresEnrichment) {
      captureTransaction.monto_fee = captureFinancials.feeAmount;
      captureTransaction.monto_neto = captureFinancials.netAmount;
    }

    const nextTransactionPayerSnapshotCandidate = resolvePreferredTrustedPayPalPayerCandidate({
      capture,
      payer,
      payerSource,
      storedOrderSnapshotContainer: paymentOrder.metadata?.paypal,
      storedTransactionSnapshotContainer: captureTransaction.metadata,
      paypalOrderId: paymentOrder.proveedor_orden_id,
      paypalCaptureId: captureFinancials.paypalCaptureId,
    });

    captureTransaction.metadata = sanitizeMetadataValue({
      ...(captureTransaction.metadata || {}),
      paypal_order_id: paymentOrder.proveedor_orden_id,
      paypal_capture_id: captureFinancials.paypalCaptureId,
      capture_status: captureFinancials.captureStatus,
      reconciled_from: source,
      capture_financials: buildCaptureFinancialMetadata(captureFinancials),
      ...mergeTrustedPayPalPayerSnapshot(captureTransaction.metadata, nextTransactionPayerSnapshotCandidate),
    });

    await manager.getRepository(Transaction).save(captureTransaction);
  }

  return {
    paymentOrder,
    transaction: captureTransaction,
  };
}

async function attemptCreateDonationCaptureTransaction({
  paymentOrder,
  captureFinancials,
  capture = null,
  payer,
  payerSource = null,
  source,
}) {
  return AppDataSource.transaction(async (manager) => {
    const { paymentProvider, category } = await resolvePayPalDependencies(
      manager,
      DONATION_CATEGORY_KEY,
    );
    const orderInTransaction = await getPaymentOrderWithRelations(manager, {
      orden_pago_id: paymentOrder.orden_pago_id,
    });

    assertDonationPaymentOrder(orderInTransaction);

    const idempotencyKey = buildPayPalIdempotencyKey(captureFinancials.paypalCaptureId);
    const existingTransaction = await findExistingDonationCaptureTransaction(manager, {
      idempotencyKey,
      paypalCaptureId: captureFinancials.paypalCaptureId,
      ordenPagoId: orderInTransaction.orden_pago_id,
    });

    if (existingTransaction) {
      const synchronized = await synchronizeCapturedPaymentOrderAndTransaction(manager, {
        paymentOrderId: orderInTransaction.orden_pago_id,
        captureTransactionId: existingTransaction.transaccion_id,
        captureFinancials,
        capture,
        payer,
        payerSource,
        source,
      });

      return buildCaptureResponse({
        paymentOrder: synchronized.paymentOrder,
        transaction: synchronized.transaction,
        paypalOrderId: orderInTransaction.proveedor_orden_id,
        paypalCaptureId: captureFinancials.paypalCaptureId,
        status: synchronized.paymentOrder.estado,
        idempotente: true,
        source,
      });
    }

    const synchronizedOrder = await synchronizeCapturedPaymentOrderAndTransaction(manager, {
      paymentOrderId: orderInTransaction.orden_pago_id,
      captureFinancials,
      capture,
      payer,
      payerSource,
      source,
    });
    const initialTransactionPayerSnapshotCandidate = resolvePreferredTrustedPayPalPayerCandidate({
      capture,
      payer,
      payerSource,
      storedOrderSnapshotContainer: synchronizedOrder.paymentOrder.metadata?.paypal,
      paypalOrderId: synchronizedOrder.paymentOrder.proveedor_orden_id,
      paypalCaptureId: captureFinancials.paypalCaptureId,
    });
    const description = normalizeNullableString(synchronizedOrder.paymentOrder.metadata?.descripcion)
      || "Donacion unica PayPal";
    const transactionRepository = manager.getRepository(Transaction);
    const transaction = transactionRepository.create({
      tipo: "INGRESO",
      estado: "CONFIRMADA",
      category: {
        categoria_transaccion_id: Number(category.categoria_transaccion_id),
      },
      payment_provider: {
        proveedor_pago_id: Number(paymentProvider.proveedor_pago_id),
      },
      payment_order: {
        orden_pago_id: Number(synchronizedOrder.paymentOrder.orden_pago_id),
      },
      donor: synchronizedOrder.paymentOrder.donor
        ? { donante_id: Number(synchronizedOrder.paymentOrder.donor.donante_id) }
        : null,
      descripcion: description,
      moneda: captureFinancials.currencyCode,
      monto_bruto: normalizeStoredMoney(
        captureFinancials.grossAmount,
        captureFinancials.currencyCode,
      ),
      monto_fee: normalizeStoredMoney(
        captureFinancials.feeAmount,
        captureFinancials.currencyCode,
      ),
      monto_neto: calculateNetAmountUsingMinorUnits(
        captureFinancials.grossAmount,
        captureFinancials.feeAmount,
        captureFinancials.currencyCode,
      ),
      fecha_transaccion: captureFinancials.updateTime
        ? new Date(captureFinancials.updateTime)
        : new Date(),
      referencia_externa: captureFinancials.paypalCaptureId,
      idempotencia_key: idempotencyKey,
      origen_tipo: "PAYPAL_DONATION_CAPTURE",
      metadata: sanitizeMetadataValue({
        paypal_order_id: synchronizedOrder.paymentOrder.proveedor_orden_id,
        paypal_capture_id: captureFinancials.paypalCaptureId,
        capture_status: captureFinancials.captureStatus,
        reconciled_from: source,
        capture_financials: buildCaptureFinancialMetadata(captureFinancials),
        ...mergeTrustedPayPalPayerSnapshot(null, initialTransactionPayerSnapshotCandidate),
      }),
    });

    const savedTransaction = await transactionRepository.save(transaction);
    const refreshedTransaction = await getTransactionWithRelations(manager, {
      transaccion_id: savedTransaction.transaccion_id,
    });

    return buildCaptureResponse({
      paymentOrder: synchronizedOrder.paymentOrder,
      transaction: refreshedTransaction,
      paypalOrderId: synchronizedOrder.paymentOrder.proveedor_orden_id,
      paypalCaptureId: captureFinancials.paypalCaptureId,
      status: synchronizedOrder.paymentOrder.estado,
      idempotente: false,
      source,
    });
  });
}

async function markCaptureAsNotCompleted({
  paymentOrder,
  captureFinancials,
  reason,
  source,
}) {
  return AppDataSource.transaction(async (manager) => {
    const orderInTransaction = await getPaymentOrderWithRelations(manager, {
      orden_pago_id: paymentOrder.orden_pago_id,
    });

    if (!orderInTransaction) {
      return null;
    }

    const nextMetadata = {
      capture_id: captureFinancials.paypalCaptureId,
      capture_status: captureFinancials.captureStatus,
      order_status: captureFinancials.captureStatus,
      capture_financials: buildCaptureFinancialMetadata(captureFinancials),
      last_reconciled_from: source,
    };

    if (PAYPAL_FAILED_CAPTURE_STATUSES.has(captureFinancials.captureStatus)) {
      return updatePaymentOrderAsFailed(manager, orderInTransaction, reason, nextMetadata);
    }

    orderInTransaction.metadata = mergeOrderMetadata(orderInTransaction, {
      paypal: {
        ...(orderInTransaction.metadata?.paypal || {}),
        order_id: orderInTransaction.proveedor_orden_id,
        ...nextMetadata,
        updated_at: toIsoTimestamp(new Date()),
      },
      last_reconciled_from: source,
    });
    await manager.getRepository(PaymentOrder).save(orderInTransaction);
    return orderInTransaction;
  });
}

async function resolveDonationRefundContext(refundFinancials, {
  refund,
  getCanonicalCapture = getPayPalCapture,
} = {}) {
  if (!refundFinancials.paypalCaptureId) {
    throw buildServiceError("No fue posible resolver capture_id para el refund PayPal.", 400);
  }

  const canonicalCapture = await getCanonicalCapture(refundFinancials.paypalCaptureId);
  const captureFinancials = normalizePayPalCaptureFinancials(canonicalCapture);

  if (
    normalizeNullableString(captureFinancials.paypalCaptureId)
    !== normalizeNullableString(refundFinancials.paypalCaptureId)
  ) {
    throw buildServiceError("La captura canonica de PayPal no coincide con el capture_id del refund.", 409);
  }

  const canonicalPayPalOrderId = resolveOrderIdFromPayPalCapture(canonicalCapture);
  const paymentOrderByProvider = canonicalPayPalOrderId
    ? await getPaymentOrderWithRelations(AppDataSource.manager, {
        proveedor_orden_id: canonicalPayPalOrderId,
      })
    : null;
  const originalCaptureTransaction = await findExistingDonationCaptureTransaction(
    AppDataSource.manager,
    {
      idempotencyKey: buildPayPalIdempotencyKey(refundFinancials.paypalCaptureId),
      paypalCaptureId: refundFinancials.paypalCaptureId,
      ordenPagoId: paymentOrderByProvider?.orden_pago_id || null,
      paypalOrderId: canonicalPayPalOrderId,
      currencyCode: captureFinancials.currencyCode,
      grossAmount: captureFinancials.grossAmount,
    },
  );
  const paymentOrderByTransaction = originalCaptureTransaction?.payment_order?.orden_pago_id
    ? await getPaymentOrderWithRelations(AppDataSource.manager, {
        orden_pago_id: Number(originalCaptureTransaction.payment_order.orden_pago_id),
      })
    : null;

  if (
    paymentOrderByProvider
    && paymentOrderByTransaction
    && Number(paymentOrderByProvider.orden_pago_id) !== Number(paymentOrderByTransaction.orden_pago_id)
  ) {
    throw buildServiceError(
      "Se detectaron referencias locales contradictorias entre la orden PayPal y la transaccion original.",
      409,
    );
  }

  const paymentOrder = paymentOrderByProvider || paymentOrderByTransaction || null;

  if (
    paymentOrder?.proveedor_orden_id
    && canonicalPayPalOrderId
    && paymentOrder.proveedor_orden_id !== canonicalPayPalOrderId
  ) {
    throw buildServiceError(
      "La orden local encontrada para el refund no coincide con la orden PayPal canonica.",
      409,
    );
  }

  const refundCustomId = normalizeNullableString(refund?.custom_id);
  const captureCustomId = normalizeNullableString(canonicalCapture?.custom_id);
  const localCustomId = normalizeNullableString(
    paymentOrder?.metadata?.paypal?.custom_id
      || paymentOrder?.metadata?.custom_id
      || originalCaptureTransaction?.metadata?.paypal?.custom_id
      || originalCaptureTransaction?.metadata?.custom_id,
  );
  const remoteCustomId = captureCustomId || refundCustomId;

  if (remoteCustomId && localCustomId && remoteCustomId !== localCustomId) {
    throw buildServiceError(
      "El custom_id de PayPal no coincide con la referencia local almacenada.",
      409,
    );
  }

  return {
    paymentOrder,
    originalCaptureTransaction,
    captureFinancials,
    canonicalPayPalOrderId,
  };
}

async function resolveOriginalCaptureTransaction({
  executor = AppDataSource.manager,
  paymentOrder,
  paypalCaptureId,
}) {
  return findExistingDonationCaptureTransaction(executor, {
    idempotencyKey: paypalCaptureId ? buildPayPalIdempotencyKey(paypalCaptureId) : null,
    paypalCaptureId,
    ordenPagoId: paymentOrder?.orden_pago_id || null,
  });
}

function buildAdminDonationRefundRequestId({
  paymentOrderId,
  originalTransactionId,
  paypalCaptureId,
  currencyCode,
  amountMinorUnits,
  alreadyRefundedMinorUnits,
  reason,
}) {
  const fingerprint = createHash("sha256")
    .update([
      Number(paymentOrderId) || 0,
      Number(originalTransactionId) || 0,
      normalizeNullableString(paypalCaptureId) || "",
      normalizeCurrency(currencyCode),
      Number(amountMinorUnits) || 0,
      Number(alreadyRefundedMinorUnits) || 0,
      normalizeCollapsedText(reason) || "",
    ].join("|"))
    .digest("hex")
    .slice(0, 24);

  return [
    "paypal",
    "refund",
    "admin",
    Number(paymentOrderId) || 0,
    Number(alreadyRefundedMinorUnits) || 0,
    Number(amountMinorUnits) || 0,
    fingerprint,
  ].join(":");
}

async function lockOriginalCaptureTransaction(manager, originalCaptureTransactionId) {
  const repository = manager.getRepository(Transaction);
  const lockErrorMessage = "No fue posible adquirir el lock pesimista requerido para conciliar la captura PayPal.";

  if (typeof repository?.createQueryBuilder !== "function") {
    throw buildServiceError(lockErrorMessage, 500);
  }

  let queryBuilder;

  try {
    queryBuilder = repository.createQueryBuilder("transaction");
  } catch {
    throw buildServiceError(lockErrorMessage, 500);
  }

  if (
    !queryBuilder
    || typeof queryBuilder.setLock !== "function"
    || typeof queryBuilder.where !== "function"
    || typeof queryBuilder.getOne !== "function"
  ) {
    throw buildServiceError(lockErrorMessage, 500);
  }

  try {
    const lockedTransaction = await queryBuilder
      .setLock("pessimistic_write")
      .where("transaction.transaccion_id = :transactionId", {
        transactionId: Number(originalCaptureTransactionId),
      })
      .getOne();

    if (!lockedTransaction) {
      throw buildServiceError("No fue posible bloquear la transaccion original del capture PayPal.", 404);
    }
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw buildServiceError(lockErrorMessage, 500);
  }

  return getTransactionWithRelations(manager, {
    transaccion_id: Number(originalCaptureTransactionId),
  });
}

async function getCompensationTransactionsForOriginalCapture(manager, {
  paymentOrderId,
  originalCaptureId,
  originalTransactionId,
  categoryKey,
  adjustmentType,
  excludedIdempotencyKey = null,
}) {
  const transactions = await getTransactionsWithRelations(manager, {
    payment_order: { orden_pago_id: Number(paymentOrderId) },
    tipo: "EGRESO",
  });

  return transactions.filter((transaction) =>
    transaction.category?.clave === categoryKey
      && transaction.payment_provider?.clave === PAYPAL_PROVIDER_KEY
      && (
        !transaction.metadata?.adjustment_type
        || transaction.metadata.adjustment_type === adjustmentType
      )
      && normalizeNullableString(transaction.metadata?.original_capture_id) === normalizeNullableString(originalCaptureId)
      && Number(transaction.metadata?.original_transaction_id || 0) === Number(originalTransactionId)
      && (
        !excludedIdempotencyKey
        || normalizeNullableString(transaction.idempotencia_key) !== normalizeNullableString(excludedIdempotencyKey)
      )
  );
}

async function calculateRefundedGrossAmount(manager, {
  paymentOrderId,
  originalCaptureId,
  originalTransactionId,
  currencyCode,
  excludedIdempotencyKey = null,
}) {
  const refundTransactions = await getCompensationTransactionsForOriginalCapture(manager, {
    paymentOrderId,
    originalCaptureId,
    originalTransactionId,
    categoryKey: DONATION_REFUND_CATEGORY_KEY,
    adjustmentType: "REFUND",
    excludedIdempotencyKey,
  });

  return sumMoneyAmounts(
    refundTransactions.map((transaction) => transaction.monto_bruto || 0),
    currencyCode,
  );
}

async function assertRefundCompensationWithinCaptureLimit(manager, {
  paymentOrder,
  originalCaptureTransaction,
  refundFinancials,
  currentRefundIdempotencyKey = null,
}) {
  const lockedOriginalCaptureTransaction = await lockOriginalCaptureTransaction(
    manager,
    originalCaptureTransaction.transaccion_id,
  );

  if (!lockedOriginalCaptureTransaction) {
    throw buildServiceError("No fue posible bloquear la transaccion original del capture PayPal.", 404);
  }

  const originalGrossMinorUnits = toMinorUnits(
    lockedOriginalCaptureTransaction.monto_bruto,
    refundFinancials.currencyCode,
  );
  const currentRefundMinorUnits = toMinorUnits(
    refundFinancials.grossAmount,
    refundFinancials.currencyCode,
  );
  const existingRefundedAmount = await calculateRefundedGrossAmount(manager, {
    paymentOrderId: paymentOrder.orden_pago_id,
    originalCaptureId: lockedOriginalCaptureTransaction.referencia_externa,
    originalTransactionId: lockedOriginalCaptureTransaction.transaccion_id,
    currencyCode: refundFinancials.currencyCode,
    excludedIdempotencyKey: currentRefundIdempotencyKey,
  });
  const existingRefundedMinorUnits = toMinorUnits(
    existingRefundedAmount,
    refundFinancials.currencyCode,
  );

  if (existingRefundedMinorUnits + currentRefundMinorUnits > originalGrossMinorUnits) {
    throw buildServiceError(
      "El monto refundado total supera el monto bruto capturado originalmente.",
      409,
    );
  }

  return lockedOriginalCaptureTransaction;
}

async function assertReversalCompensationIsAllowed(manager, {
  paymentOrder,
  originalCaptureTransaction,
  reversalSnapshot,
}) {
  const lockedOriginalCaptureTransaction = await lockOriginalCaptureTransaction(
    manager,
    originalCaptureTransaction.transaccion_id,
  );

  if (!lockedOriginalCaptureTransaction) {
    throw buildServiceError("No fue posible bloquear la transaccion original del capture PayPal.", 404);
  }

  const originalGrossMinorUnits = toMinorUnits(
    lockedOriginalCaptureTransaction.monto_bruto,
    reversalSnapshot.currencyCode,
  );
  const reversalMinorUnits = toMinorUnits(
    reversalSnapshot.grossAmount,
    reversalSnapshot.currencyCode,
  );

  if (reversalMinorUnits > originalGrossMinorUnits) {
    throw buildServiceError(
      "La reversa PayPal supera el monto bruto capturado originalmente.",
      409,
    );
  }

  const existingReversals = await getCompensationTransactionsForOriginalCapture(manager, {
    paymentOrderId: paymentOrder.orden_pago_id,
    originalCaptureId: lockedOriginalCaptureTransaction.referencia_externa,
    originalTransactionId: lockedOriginalCaptureTransaction.transaccion_id,
    categoryKey: PAYPAL_REVERSAL_CATEGORY_KEY,
    adjustmentType: "REVERSAL",
  });

  const semanticDuplicate = existingReversals.find(
    (transaction) => normalizeNullableString(transaction.idempotencia_key) !== buildPayPalReversalIdempotencyKey(reversalSnapshot.reversalFactId),
  );

  if (semanticDuplicate) {
    throw buildServiceError(
      "Ya existe una reversa PayPal completa para la captura indicada.",
      409,
    );
  }

  return lockedOriginalCaptureTransaction;
}

async function updatePaymentOrderAfterRefund(manager, {
  paymentOrderId,
  originalCaptureTransaction,
  refundFinancials,
  source,
}) {
  const paymentOrder = await getPaymentOrderWithRelations(manager, {
    orden_pago_id: Number(paymentOrderId),
  });

  assertDonationPaymentOrder(paymentOrder);

  const totalRefundedAmount = await calculateRefundedGrossAmount(manager, {
    paymentOrderId,
    originalCaptureId: originalCaptureTransaction.referencia_externa,
    originalTransactionId: originalCaptureTransaction.transaccion_id,
    currencyCode: refundFinancials.currencyCode,
  });
  const totalRefundedMinorUnits = toMinorUnits(totalRefundedAmount, paymentOrder.moneda);
  const paymentOrderGrossMinorUnits = toMinorUnits(paymentOrder.monto_bruto, paymentOrder.moneda);
  const isFullyRefunded = totalRefundedMinorUnits >= paymentOrderGrossMinorUnits;
  const remainingMinorUnits = Math.max(paymentOrderGrossMinorUnits - totalRefundedMinorUnits, 0);
  const refundIds = Array.from(new Set([
    ...(
      Array.isArray(paymentOrder.metadata?.refund_summary?.refund_ids)
        ? paymentOrder.metadata.refund_summary.refund_ids
        : []
    ),
    refundFinancials.paypalRefundId,
  ].filter(Boolean)));

  paymentOrder.estado = isFullyRefunded
    ? PAYMENT_ORDER_REFUNDED_STATE
    : paymentOrder.estado;
  paymentOrder.metadata = mergeOrderMetadata(paymentOrder, {
    paypal: {
      ...(paymentOrder.metadata?.paypal || {}),
      order_id: paymentOrder.proveedor_orden_id,
      last_refund_id: refundFinancials.paypalRefundId,
      paypal_refund_status: refundFinancials.refundStatus,
      total_refunded: totalRefundedAmount,
      remaining_amount: fromMinorUnits(remainingMinorUnits, paymentOrder.moneda),
      refund_ids: refundIds,
      refund_currency_code: refundFinancials.currencyCode,
      updated_at: toIsoTimestamp(new Date()),
    },
    refund_summary: {
      refund_ids: refundIds,
      total_refunded: totalRefundedAmount,
      remaining_amount: fromMinorUnits(remainingMinorUnits, paymentOrder.moneda),
      paypal_refund_status: refundFinancials.refundStatus,
      fully_refunded: isFullyRefunded,
      last_refund_id: refundFinancials.paypalRefundId,
      last_reconciled_from: source,
    },
  });

  await manager.getRepository(PaymentOrder).save(paymentOrder);
  return paymentOrder;
}

async function enrichExistingRefundCompensationTransaction(manager, existingTransaction, {
  refundFinancials,
  paymentOrder,
  metadata,
}) {
  if (!existingTransaction) {
    return null;
  }

  const existingFeeMinorUnits = toMinorUnits(existingTransaction.monto_fee || 0, refundFinancials.currencyCode);
  const existingNetMinorUnits = toMinorUnits(
    existingTransaction.monto_neto ?? existingTransaction.monto_bruto,
    refundFinancials.currencyCode,
  );
  const expectedGrossMinorUnits = toMinorUnits(refundFinancials.grossAmount, refundFinancials.currencyCode);
  const expectedFeeMinorUnits = toMinorUnits(refundFinancials.feeAmount, refundFinancials.currencyCode);
  const expectedNetMinorUnits = toMinorUnits(refundFinancials.netAmount, refundFinancials.currencyCode);
  const currentGrossMinorUnits = toMinorUnits(existingTransaction.monto_bruto, refundFinancials.currencyCode);
  const provisionalLegacyValues = (
    existingFeeMinorUnits === 0
    && existingNetMinorUnits === currentGrossMinorUnits
  );
  const alreadyCanonical = (
    existingFeeMinorUnits === expectedFeeMinorUnits
    && existingNetMinorUnits === expectedNetMinorUnits
  );

  if (currentGrossMinorUnits !== expectedGrossMinorUnits) {
    throw buildServiceError(
      "La transaccion compensatoria existente del refund PayPal tiene monto_bruto inconsistente.",
      409,
    );
  }

  if (existingTransaction.moneda !== refundFinancials.currencyCode) {
    throw buildServiceError(
      "La transaccion compensatoria existente del refund PayPal tiene moneda inconsistente.",
      409,
    );
  }

  if (alreadyCanonical) {
    return getTransactionWithRelations(manager, {
      transaccion_id: existingTransaction.transaccion_id,
    });
  }

  if (!provisionalLegacyValues) {
    throw buildServiceError(
      "La transaccion compensatoria existente del refund PayPal tiene fee/net inconsistentes.",
      409,
    );
  }

  const mergedMetadata = sanitizeMetadataValue({
    ...(existingTransaction.metadata || {}),
    ...(metadata || {}),
    adjustment_type: "REFUND",
    original_payment_order_id: Number(paymentOrder.orden_pago_id),
  });

  await manager.getRepository(Transaction).update(
    { transaccion_id: Number(existingTransaction.transaccion_id) },
    {
      monto_fee: normalizeStoredMoney(refundFinancials.feeAmount, refundFinancials.currencyCode),
      monto_neto: normalizeStoredMoney(refundFinancials.netAmount, refundFinancials.currencyCode),
      metadata: mergedMetadata,
    },
  );

  return getTransactionWithRelations(manager, {
    transaccion_id: existingTransaction.transaccion_id,
  });
}

async function finalizeExistingCompensationTransaction({
  paymentOrder,
  originalCaptureTransaction,
  idempotencyKey,
  referenciaExterna,
  categoryKey,
  adjustmentType,
  currencyCode,
  grossAmount,
  metadata,
  source,
  markPaymentOrder,
  validateBeforeCreate = null,
}) {
  return AppDataSource.transaction(async (manager) => {
    if (typeof validateBeforeCreate === "function") {
      await validateBeforeCreate(manager);
    }

    const existingTransaction = await findExistingCompensationTransaction(manager, {
      idempotencyKey,
      referenciaExterna,
      categoryKey,
      adjustmentType,
      currencyCode,
      grossAmount,
    });

    if (!existingTransaction) {
      return null;
    }

    const updatedTransaction = adjustmentType === "REFUND"
      ? await enrichExistingRefundCompensationTransaction(manager, existingTransaction, {
          refundFinancials: metadata?.refund_financials,
          paymentOrder,
          metadata,
        })
      : await getTransactionWithRelations(manager, {
          transaccion_id: existingTransaction.transaccion_id,
        });
    const updatedPaymentOrder = markPaymentOrder
      ? await markPaymentOrder(manager)
      : await getPaymentOrderWithRelations(manager, {
          orden_pago_id: paymentOrder.orden_pago_id,
        });

    return buildCaptureResponse({
      paymentOrder: updatedPaymentOrder,
      transaction: updatedTransaction,
      paypalOrderId: paymentOrder.proveedor_orden_id,
      paypalCaptureId: originalCaptureTransaction?.referencia_externa || null,
      paypalRefundId: metadata?.paypal_refund_id || metadata?.refund_fact_id || null,
      status: updatedPaymentOrder?.estado || paymentOrder.estado,
      idempotente: true,
      source,
    });
  });
}

async function createCompensationTransactionInManager(manager, {
  paymentOrder,
  originalCaptureTransaction,
  idempotencyKey,
  referenciaExterna,
  categoryKey,
  descripcion,
  origenTipo,
  grossAmount,
  currencyCode,
  occurredAt,
  metadata,
  source,
  markPaymentOrder,
  adjustmentType,
  validateBeforeCreate = null,
  createdByUserId = null,
}) {
  const { paymentProvider, category } = await resolvePayPalDependencies(manager, categoryKey);

  if (typeof validateBeforeCreate === "function") {
    await validateBeforeCreate(manager);
  }

  const existingTransaction = await findExistingCompensationTransaction(manager, {
    idempotencyKey,
    referenciaExterna,
    categoryKey,
    adjustmentType,
    currencyCode,
    grossAmount,
  });

  if (existingTransaction) {
    const updatedTransaction = adjustmentType === "REFUND"
      ? await enrichExistingRefundCompensationTransaction(manager, existingTransaction, {
          refundFinancials: metadata?.refund_financials,
          paymentOrder,
          metadata,
        })
      : await getTransactionWithRelations(manager, {
          transaccion_id: existingTransaction.transaccion_id,
        });
    const updatedPaymentOrder = markPaymentOrder
      ? await markPaymentOrder(manager)
      : await getPaymentOrderWithRelations(manager, {
          orden_pago_id: paymentOrder.orden_pago_id,
        });

    return buildCaptureResponse({
      paymentOrder: updatedPaymentOrder,
      transaction: updatedTransaction,
      paypalOrderId: paymentOrder.proveedor_orden_id,
      paypalCaptureId: originalCaptureTransaction?.referencia_externa || null,
      paypalRefundId: metadata?.paypal_refund_id || metadata?.refund_fact_id || null,
      status: updatedPaymentOrder?.estado || paymentOrder.estado,
      idempotente: true,
      source,
    });
  }

  const transactionRepository = manager.getRepository(Transaction);
  const transaction = transactionRepository.create({
    tipo: "EGRESO",
    estado: "CONFIRMADA",
    category: {
      categoria_transaccion_id: Number(category.categoria_transaccion_id),
    },
    payment_provider: {
      proveedor_pago_id: Number(paymentProvider.proveedor_pago_id),
    },
    payment_order: {
      orden_pago_id: Number(paymentOrder.orden_pago_id),
    },
    donor: paymentOrder.donor
      ? { donante_id: Number(paymentOrder.donor.donante_id) }
      : null,
    created_by: createdByUserId
      ? { id_usuario: Number(createdByUserId) }
      : null,
    descripcion,
    moneda: currencyCode,
    monto_bruto: normalizeStoredMoney(grossAmount, currencyCode),
    monto_fee: normalizeStoredMoney(metadata?.refund_financials?.feeAmount ?? 0, currencyCode),
    monto_neto: normalizeStoredMoney(
      metadata?.refund_financials?.netAmount ?? grossAmount,
      currencyCode,
    ),
    fecha_transaccion: occurredAt ? new Date(occurredAt) : new Date(),
    referencia_externa: referenciaExterna,
    idempotencia_key: idempotencyKey,
    origen_tipo: origenTipo,
    metadata: sanitizeMetadataValue({
      ...(metadata || {}),
      adjustment_type: adjustmentType || metadata?.adjustment_type || null,
      original_payment_order_id: Number(paymentOrder.orden_pago_id),
    }),
  });

  const savedTransaction = await transactionRepository.save(transaction);
  const updatedPaymentOrder = markPaymentOrder
    ? await markPaymentOrder(manager)
    : await getPaymentOrderWithRelations(manager, {
        orden_pago_id: paymentOrder.orden_pago_id,
      });
  const refreshedTransaction = await getTransactionWithRelations(manager, {
    transaccion_id: savedTransaction.transaccion_id,
  });

  return buildCaptureResponse({
    paymentOrder: updatedPaymentOrder,
    transaction: refreshedTransaction,
    paypalOrderId: paymentOrder.proveedor_orden_id,
    paypalCaptureId: originalCaptureTransaction?.referencia_externa || null,
    paypalRefundId: metadata?.paypal_refund_id || null,
    status: updatedPaymentOrder?.estado || paymentOrder.estado,
    idempotente: false,
    source,
  });
}

async function attemptCreateCompensationTransaction({
  paymentOrder,
  originalCaptureTransaction,
  idempotencyKey,
  referenciaExterna,
  categoryKey,
  descripcion,
  origenTipo,
  grossAmount,
  currencyCode,
  occurredAt,
  metadata,
  source,
  markPaymentOrder,
  adjustmentType,
  validateBeforeCreate = null,
  createdByUserId = null,
}) {
  return AppDataSource.transaction(async (manager) =>
    createCompensationTransactionInManager(manager, {
      paymentOrder,
      originalCaptureTransaction,
      idempotencyKey,
      referenciaExterna,
      categoryKey,
      descripcion,
      origenTipo,
      grossAmount,
      currencyCode,
      occurredAt,
      metadata,
      source,
      markPaymentOrder,
      adjustmentType,
      validateBeforeCreate,
      createdByUserId,
    }));
}

export async function createAdminPayPalDonationRefundService({
  paymentOrderId,
  amount,
  reason,
  authContext = {},
  now = new Date(),
  createRefund = refundPayPalCapture,
  getCanonicalRefund = getPayPalRefund,
} = {}) {
  try {
    const normalizedPaymentOrderId = Number(paymentOrderId);
    if (!Number.isInteger(normalizedPaymentOrderId) || normalizedPaymentOrderId <= 0) {
      throw buildServiceError("paymentOrderId invalido.", 400);
    }

    const normalizedAmount = toNumericNumber(amount, NaN);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw buildServiceError("El monto a reembolsar debe ser mayor a 0.", 400);
    }

    const normalizedReason = normalizeRefundReason(reason, { statusCode: 400 });

    const result = await AppDataSource.transaction(async (manager) => {
      const paymentOrder = await getPaymentOrderWithRelations(manager, {
        orden_pago_id: normalizedPaymentOrderId,
      });

      if (!paymentOrder) {
        throw buildServiceError("Donacion no encontrada.", 404);
      }

      assertDonationPaymentOrder(paymentOrder);

      const paypalCaptureId = normalizeNullableString(paymentOrder.metadata?.paypal?.capture_id);
      const originalCaptureTransaction = await resolveOriginalCaptureTransaction({
        executor: manager,
        paymentOrder,
        paypalCaptureId,
      });

      if (!originalCaptureTransaction) {
        throw buildServiceError("La donacion no tiene una captura PayPal confirmada.", 409);
      }

      const lockedOriginalCaptureTransaction = await lockOriginalCaptureTransaction(
        manager,
        originalCaptureTransaction.transaccion_id,
      );

      const existingRefundedAmount = await calculateRefundedGrossAmount(manager, {
        paymentOrderId: paymentOrder.orden_pago_id,
        originalCaptureId: lockedOriginalCaptureTransaction.referencia_externa,
        originalTransactionId: lockedOriginalCaptureTransaction.transaccion_id,
        currencyCode: paymentOrder.moneda,
      });
      const existingRefundedMinorUnits = toMinorUnits(existingRefundedAmount, paymentOrder.moneda);
      const originalGrossMinorUnits = toMinorUnits(
        lockedOriginalCaptureTransaction.monto_bruto,
        paymentOrder.moneda,
      );
      const remainingMinorUnits = Math.max(originalGrossMinorUnits - existingRefundedMinorUnits, 0);
      const remainingAmount = fromMinorUnits(remainingMinorUnits, paymentOrder.moneda);
      const existingReversals = await getCompensationTransactionsForOriginalCapture(manager, {
        paymentOrderId: paymentOrder.orden_pago_id,
        originalCaptureId: lockedOriginalCaptureTransaction.referencia_externa,
        originalTransactionId: lockedOriginalCaptureTransaction.transaccion_id,
        categoryKey: PAYPAL_REVERSAL_CATEGORY_KEY,
        adjustmentType: "REVERSAL",
      });

      const eligibility = getDonationRefundEligibility(
        paymentOrder,
        lockedOriginalCaptureTransaction,
        {
          now,
          remainingAmount,
          hasReversal: existingReversals.length > 0,
        },
      );

      if (!eligibility.canRefund) {
        throw buildServiceError(eligibility.reason, 409);
      }

      const requestedAmountMinorUnits = toMinorUnits(normalizedAmount, paymentOrder.moneda);
      if (requestedAmountMinorUnits > remainingMinorUnits) {
        throw buildServiceError(
          "El monto solicitado supera el saldo reembolsable disponible.",
          409,
        );
      }

      const requestId = buildAdminDonationRefundRequestId({
        paymentOrderId: paymentOrder.orden_pago_id,
        originalTransactionId: lockedOriginalCaptureTransaction.transaccion_id,
        paypalCaptureId: lockedOriginalCaptureTransaction.referencia_externa,
        currencyCode: paymentOrder.moneda,
        amountMinorUnits: requestedAmountMinorUnits,
        alreadyRefundedMinorUnits: existingRefundedMinorUnits,
        reason: normalizedReason,
      });

      const paypalRefundDraft = await createRefund(
        lockedOriginalCaptureTransaction.referencia_externa,
        {
          amount: fromMinorUnits(requestedAmountMinorUnits, paymentOrder.moneda),
          currencyCode: paymentOrder.moneda,
          requestId,
          noteToPayer: normalizedReason,
        },
      );

      const canonicalRefund = (
        paypalRefundDraft?.seller_payable_breakdown
        && normalizeCode(paypalRefundDraft?.status) === "COMPLETED"
      )
        ? paypalRefundDraft
        : (
            paypalRefundDraft?.id
              ? await getCanonicalRefund(paypalRefundDraft.id)
              : null
          );

      if (!canonicalRefund) {
        throw buildServiceError("PayPal no devolvio un refund identificable para conciliar localmente.", 502);
      }

      const refundFinancials = normalizePayPalRefundFinancials(canonicalRefund);

      if (refundFinancials.refundStatus !== "COMPLETED") {
        throw buildServiceError(
          "PayPal no confirmo inmediatamente el refund solicitado. Intenta revisar el estado mas tarde.",
          409,
        );
      }

      if (refundFinancials.currencyCode !== paymentOrder.moneda) {
        throw buildServiceError("El refund PayPal tiene una moneda inconsistente con la donacion.", 409);
      }

      if (
        normalizeNullableString(refundFinancials.paypalCaptureId)
        !== normalizeNullableString(lockedOriginalCaptureTransaction.referencia_externa)
      ) {
        throw buildServiceError("El refund PayPal no corresponde a la captura original esperada.", 409);
      }

      return createCompensationTransactionInManager(manager, {
        paymentOrder,
        originalCaptureTransaction: lockedOriginalCaptureTransaction,
        idempotencyKey: buildPayPalRefundIdempotencyKey(refundFinancials.paypalRefundId),
        referenciaExterna: refundFinancials.paypalRefundId,
        categoryKey: DONATION_REFUND_CATEGORY_KEY,
        descripcion: "Reembolso PayPal de donacion unica",
        origenTipo: "PAYPAL_DONATION_REFUND",
        grossAmount: refundFinancials.grossAmount,
        currencyCode: refundFinancials.currencyCode,
        occurredAt: refundFinancials.updateTime || refundFinancials.createTime,
        metadata: {
          adjustment_type: "REFUND",
          paypal_order_id: paymentOrder.proveedor_orden_id,
          paypal_capture_id: refundFinancials.paypalCaptureId,
          paypal_refund_id: refundFinancials.paypalRefundId,
          refund_status: refundFinancials.refundStatus,
          refund_breakdown_source: refundFinancials.refundBreakdownSource,
          refund_gross_amount: refundFinancials.grossAmount,
          paypal_fee_amount: refundFinancials.feeAmount,
          seller_payable_net_amount: refundFinancials.netAmount,
          paypal_fee_effect: "CREDITED_OR_OFFSET_BY_PAYPAL",
          original_transaction_id: lockedOriginalCaptureTransaction.transaccion_id,
          original_capture_id: lockedOriginalCaptureTransaction.referencia_externa,
          original_payment_order_id: paymentOrder.orden_pago_id,
          refund_fact_id: refundFinancials.paypalRefundId,
          reconciled_from: ADMIN_DONATION_REFUND_SOURCE,
          refund_reason: normalizedReason,
          refund_requested_by_user_id: authContext.userId || null,
          refund_requested_from: ADMIN_DONATION_REFUND_FLOW_KEY,
          paypal_request_id: requestId,
          refund_financials: {
            grossAmount: refundFinancials.grossAmount,
            feeAmount: refundFinancials.feeAmount,
            netAmount: refundFinancials.netAmount,
            currencyCode: refundFinancials.currencyCode,
            refundBreakdownSource: refundFinancials.refundBreakdownSource,
          },
        },
        source: ADMIN_DONATION_REFUND_SOURCE,
        adjustmentType: "REFUND",
        validateBeforeCreate: async (lockedManager) => {
          await assertRefundCompensationWithinCaptureLimit(lockedManager, {
            paymentOrder,
            originalCaptureTransaction: lockedOriginalCaptureTransaction,
            refundFinancials,
            currentRefundIdempotencyKey: buildPayPalRefundIdempotencyKey(refundFinancials.paypalRefundId),
          });
        },
        markPaymentOrder: async (lockedManager) => updatePaymentOrderAfterRefund(lockedManager, {
          paymentOrderId: paymentOrder.orden_pago_id,
          originalCaptureTransaction: lockedOriginalCaptureTransaction,
          refundFinancials,
          source: ADMIN_DONATION_REFUND_SOURCE,
        }),
        createdByUserId: authContext.userId || null,
      });
    });

    return [result, null];
  } catch (error) {
    const statusCode = error?.statusCode
      || (error instanceof PayPalApiError ? error.statusCode || 502 : 400);
    return [
      null,
      buildServiceError(
        error?.message || "No fue posible crear el refund PayPal administrativo.",
        statusCode,
      ),
    ];
  }
}

export async function createPayPalDonationOrderService(body, {
  createOrder = createPayPalOrder,
} = {}) {
  try {
    const currency = normalizeCurrency(body.moneda || PAYPAL_CURRENCY);
    const amount = toNumericNumber(body.monto_bruto, NaN);
    const description = normalizeNullableString(body.descripcion) || "Donacion unica";
    const identityIntent = resolveDonationIdentityIntent(body);
    const publicMetadata = sanitizeMetadataValue(body.metadata || null);

    await AppDataSource.transaction(async (manager) =>
      resolvePayPalDependencies(manager, DONATION_CATEGORY_KEY));

    const paypalOrder = await createOrder({
      amount,
      currency,
      description,
      customId: `donacion-unica:${randomUUID()}`,
      returnUrl: PAYPAL_DONATION_SUCCESS_URL,
      cancelUrl: PAYPAL_DONATION_CANCEL_URL,
    });
    const approvalUrl = extractPayPalApprovalUrl(paypalOrder);

    if (!paypalOrder?.id || !approvalUrl) {
      throw new Error("PayPal no devolvio una orden aprobable valida.");
    }

    const order = await AppDataSource.transaction(async (manager) => {
      const { paymentProvider, category } = await resolvePayPalDependencies(
        manager,
        DONATION_CATEGORY_KEY,
      );
      const repository = manager.getRepository(PaymentOrder);
      const newOrder = repository.create({
        payment_provider: { proveedor_pago_id: Number(paymentProvider.proveedor_pago_id) },
        donor: null,
        proveedor_orden_id: paypalOrder.id,
        proposito: DONATION_CATEGORY_KEY,
        moneda: currency,
        monto_bruto: amount,
        estado: PAYMENT_ORDER_CREATED_STATE,
        approval_url: approvalUrl,
        metadata: buildDonationIdentityMetadata({
          descripcion: description,
          public_metadata: publicMetadata,
          paypal: {
            order_id: paypalOrder.id,
            order_status: normalizeCode(paypalOrder.status) || "CREATED",
            created_at: toIsoTimestamp(new Date()),
          },
          categoria_clave: category.clave,
        }, {
          identityMode: identityIntent.identityMode,
          linkStatus: identityIntent.linkStatus,
          donorPublicData: null,
          consentimientoDatos: false,
          donorId: null,
          identitySource: null,
          linkError: null,
          attemptedAt: null,
          linkedAt: null,
        }),
      });

      const savedOrder = await repository.save(newOrder);
      return getPaymentOrderWithRelations(manager, { orden_pago_id: savedOrder.orden_pago_id });
    });

    return [mapCreateOrderResult(order), null];
  } catch (error) {
    const statusCode = error instanceof PayPalApiError ? error.statusCode || 502 : 400;
    return [null, buildServiceError(error.message || "Error al crear la orden PayPal.", statusCode)];
  }
}

export async function reconcilePayPalDonationCapture({
  paypalOrderId,
  capture,
  payer = null,
  payerSource = null,
  source = "capture-order",
  getCanonicalOrder = getPayPalOrder,
}) {
  const captureFinancials = normalizePayPalCaptureFinancials(capture);
  const payerMetadata = pickPayPalPayer(capture?.payer) || payer || null;
  const resolvedPayPalOrderId = paypalOrderId || captureFinancials.paypalOrderId;

  if (!resolvedPayPalOrderId) {
    throw buildServiceError("No fue posible resolver paypal_order_id para la captura PayPal.", 400);
  }

  if (
    captureFinancials.paypalOrderId
    && captureFinancials.paypalOrderId !== resolvedPayPalOrderId
  ) {
    throw buildServiceError("paypal_order_id no coincide con la captura PayPal canonica.", 409);
  }

  const paymentOrder = await getPaymentOrderWithRelations(AppDataSource.manager, {
    proveedor_orden_id: resolvedPayPalOrderId,
  });

  assertDonationPaymentOrder(paymentOrder);

  if (captureFinancials.captureStatus !== "COMPLETED") {
    await markCaptureAsNotCompleted({
      paymentOrder,
      captureFinancials,
      reason: `PayPal devolvio estado ${captureFinancials.captureStatus}.`,
      source,
    });

    throw buildServiceError(
      "La captura de PayPal no fue completada. No se creo ninguna transaccion.",
      409,
    );
  }

  const idempotencyKey = buildPayPalIdempotencyKey(captureFinancials.paypalCaptureId);
  const existingTransaction = await findExistingDonationCaptureTransaction(AppDataSource.manager, {
    idempotencyKey,
    paypalCaptureId: captureFinancials.paypalCaptureId,
    ordenPagoId: paymentOrder.orden_pago_id,
  });
  let financialResult;

  if (existingTransaction) {
    await AppDataSource.transaction(async (manager) => {
      await synchronizeCapturedPaymentOrderAndTransaction(manager, {
        paymentOrderId: paymentOrder.orden_pago_id,
        captureTransactionId: existingTransaction.transaccion_id,
        captureFinancials,
        capture,
        payer: payerMetadata,
        payerSource,
        source,
      });
    });

    financialResult = await buildCaptureResponse({
      paymentOrder,
      transaction: existingTransaction,
      paypalOrderId: resolvedPayPalOrderId,
      paypalCaptureId: captureFinancials.paypalCaptureId,
      status: PAYMENT_ORDER_CAPTURED_STATE,
      idempotente: true,
      source,
    });
  } else {
    try {
      financialResult = await attemptCreateDonationCaptureTransaction({
      paymentOrder,
      captureFinancials,
      capture,
      payer: payerMetadata,
      payerSource,
      source,
    });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const recoveredTransaction = await findExistingDonationCaptureTransaction(AppDataSource.manager, {
        idempotencyKey,
        paypalCaptureId: captureFinancials.paypalCaptureId,
        ordenPagoId: paymentOrder.orden_pago_id,
      });

      if (recoveredTransaction) {
        await AppDataSource.transaction(async (manager) => {
          await synchronizeCapturedPaymentOrderAndTransaction(manager, {
            paymentOrderId: paymentOrder.orden_pago_id,
            captureTransactionId: recoveredTransaction.transaccion_id,
            captureFinancials,
            capture,
            payer: payerMetadata,
            payerSource,
            source,
          });
        });

        financialResult = await buildCaptureResponse({
          paymentOrder,
          transaction: recoveredTransaction,
          paypalOrderId: resolvedPayPalOrderId,
          paypalCaptureId: captureFinancials.paypalCaptureId,
          status: PAYMENT_ORDER_CAPTURED_STATE,
          idempotente: true,
          source,
        });
      } else {
        throw buildServiceError(
          "Ocurrio una carrera de idempotencia, pero no fue posible recuperar la transaccion existente.",
          409,
        );
      }
    }
  }

  await attemptNonBlockingDonationDonorLink({
    paymentOrderId: financialResult?.orden_pago?.orden_pago_id || paymentOrder.orden_pago_id,
    captureTransactionId: financialResult?.transaccion?.transaccion_id || existingTransaction?.transaccion_id || null,
    capture,
    payer: payerMetadata,
    payerSource,
    getCanonicalOrder,
  });

  return buildCaptureResponse({
    paymentOrder: {
      orden_pago_id: financialResult?.orden_pago?.orden_pago_id || paymentOrder.orden_pago_id,
    },
    transaction: financialResult?.transaccion?.transaccion_id
      ? { transaccion_id: financialResult.transaccion.transaccion_id }
      : financialResult?.transaccion || null,
    paypalOrderId: resolvedPayPalOrderId,
    paypalCaptureId: captureFinancials.paypalCaptureId,
    status: PAYMENT_ORDER_CAPTURED_STATE,
    idempotente: Boolean(financialResult?.idempotente),
    source,
  });
}

export async function reconcilePayPalDonationRefund({
  refund,
  source = "webhook:PAYMENT.CAPTURE.REFUNDED",
  webhookEventId = null,
  getCanonicalCapture = getPayPalCapture,
  signedWebhookRefundResource = null,
  signedWebhookEventType = null,
}) {
  let refundFinancials;

  try {
    refundFinancials = normalizePayPalRefundFinancials(refund, {
      signedWebhookRefundResource,
      signedWebhookEventType,
    });
  } catch (error) {
    throw buildServiceError(
      error.message || "No fue posible normalizar financieramente el refund PayPal.",
      /PAYPAL_REFUND_BREAKDOWN_UNAVAILABLE/i.test(error?.message || "")
        ? 400
        : 409,
    );
  }

  if (refundFinancials.refundStatus !== "COMPLETED") {
    throw buildServiceError(
      `El refund canonico de PayPal no esta COMPLETED. Estado recibido: ${refundFinancials.refundStatus || "DESCONOCIDO"}.`,
      409,
    );
  }

  let paymentOrder;
  let originalCaptureTransaction;
  let captureFinancials;

  try {
    ({
      paymentOrder,
      originalCaptureTransaction,
      captureFinancials,
    } = await resolveDonationRefundContext(refundFinancials, {
      refund,
      getCanonicalCapture,
    }));
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    throw buildServiceError(
      error.message || "No fue posible resolver el contexto del refund PayPal.",
      409,
    );
  }

  assertDonationPaymentOrder(paymentOrder);

  if (!originalCaptureTransaction) {
    throw buildServiceError("No fue posible resolver la transaccion original del capture PayPal.", 404);
  }

  if (refundFinancials.currencyCode !== captureFinancials.currencyCode) {
    throw buildServiceError("El reembolso PayPal tiene una moneda inconsistente con la captura canonica.", 409);
  }

  if (refundFinancials.currencyCode !== originalCaptureTransaction.moneda) {
    throw buildServiceError("El reembolso PayPal tiene una moneda inconsistente con la captura original.", 409);
  }

  const idempotencyKey = buildPayPalRefundIdempotencyKey(refundFinancials.paypalRefundId);

  try {
    return await attemptCreateCompensationTransaction({
      paymentOrder,
      originalCaptureTransaction,
      idempotencyKey,
      referenciaExterna: refundFinancials.paypalRefundId,
      categoryKey: DONATION_REFUND_CATEGORY_KEY,
      descripcion: "Reembolso PayPal de donacion unica",
      origenTipo: "PAYPAL_DONATION_REFUND",
      grossAmount: refundFinancials.grossAmount,
      currencyCode: refundFinancials.currencyCode,
      occurredAt: refundFinancials.updateTime || refundFinancials.createTime,
      metadata: {
        adjustment_type: "REFUND",
        paypal_order_id: paymentOrder.proveedor_orden_id,
        paypal_capture_id: refundFinancials.paypalCaptureId,
        paypal_refund_id: refundFinancials.paypalRefundId,
        refund_status: refundFinancials.refundStatus,
        refund_breakdown_source: refundFinancials.refundBreakdownSource,
        refund_gross_amount: refundFinancials.grossAmount,
        paypal_fee_amount: refundFinancials.feeAmount,
        seller_payable_net_amount: refundFinancials.netAmount,
        paypal_fee_effect: "CREDITED_OR_OFFSET_BY_PAYPAL",
        original_transaction_id: originalCaptureTransaction.transaccion_id,
        original_capture_id: originalCaptureTransaction.referencia_externa,
        original_payment_order_id: paymentOrder.orden_pago_id,
        refund_fact_id: refundFinancials.paypalRefundId,
        reconciled_from: source,
        webhook_event_id: webhookEventId,
        refund_financials: {
          grossAmount: refundFinancials.grossAmount,
          feeAmount: refundFinancials.feeAmount,
          netAmount: refundFinancials.netAmount,
          currencyCode: refundFinancials.currencyCode,
          refundBreakdownSource: refundFinancials.refundBreakdownSource,
        },
      },
      source,
      adjustmentType: "REFUND",
      validateBeforeCreate: async (manager) => {
        await assertRefundCompensationWithinCaptureLimit(manager, {
          paymentOrder,
          originalCaptureTransaction,
          refundFinancials,
          currentRefundIdempotencyKey: idempotencyKey,
        });
      },
      markPaymentOrder: async (manager) => updatePaymentOrderAfterRefund(manager, {
        paymentOrderId: paymentOrder.orden_pago_id,
        originalCaptureTransaction,
        refundFinancials,
        source,
      }),
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const recoveredResponse = await finalizeExistingCompensationTransaction({
      paymentOrder,
      originalCaptureTransaction,
      idempotencyKey,
      referenciaExterna: refundFinancials.paypalRefundId,
      categoryKey: DONATION_REFUND_CATEGORY_KEY,
      adjustmentType: "REFUND",
      currencyCode: refundFinancials.currencyCode,
      grossAmount: refundFinancials.grossAmount,
      metadata: {
        paypal_refund_id: refundFinancials.paypalRefundId,
        refund_fact_id: refundFinancials.paypalRefundId,
        refund_breakdown_source: refundFinancials.refundBreakdownSource,
        refund_gross_amount: refundFinancials.grossAmount,
        paypal_fee_amount: refundFinancials.feeAmount,
        seller_payable_net_amount: refundFinancials.netAmount,
        paypal_fee_effect: "CREDITED_OR_OFFSET_BY_PAYPAL",
        refund_financials: {
          grossAmount: refundFinancials.grossAmount,
          feeAmount: refundFinancials.feeAmount,
          netAmount: refundFinancials.netAmount,
          currencyCode: refundFinancials.currencyCode,
          refundBreakdownSource: refundFinancials.refundBreakdownSource,
        },
      },
      source,
      validateBeforeCreate: async (manager) => {
        await assertRefundCompensationWithinCaptureLimit(manager, {
          paymentOrder,
          originalCaptureTransaction,
          refundFinancials,
          currentRefundIdempotencyKey: idempotencyKey,
        });
      },
      markPaymentOrder: async (manager) => updatePaymentOrderAfterRefund(manager, {
        paymentOrderId: paymentOrder.orden_pago_id,
        originalCaptureTransaction,
        refundFinancials,
        source,
      }),
    });

    if (!recoveredResponse) {
      throw buildServiceError(
        "Ocurrio una carrera de idempotencia, pero no fue posible recuperar el reembolso PayPal.",
        409,
      );
    }

    return recoveredResponse;
  }
}

export async function reconcilePayPalDonationReversal({
  webhookEvent,
  canonicalCapture,
  source = "webhook:PAYMENT.CAPTURE.REVERSED",
}) {
  const reversalSnapshot = normalizePayPalReversalSnapshot({
    webhookEvent,
    canonicalCapture,
  });
  const paymentOrder = await getPaymentOrderWithRelations(AppDataSource.manager, {
    proveedor_orden_id: reversalSnapshot.paypalOrderId,
  });

  assertDonationPaymentOrder(paymentOrder);

  const originalCaptureTransaction = await resolveOriginalCaptureTransaction({
    paymentOrder,
    paypalCaptureId: reversalSnapshot.paypalCaptureId,
  });

  if (!originalCaptureTransaction) {
    throw buildServiceError("No fue posible resolver la transaccion original del capture PayPal.", 404);
  }

  const idempotencyKey = buildPayPalReversalIdempotencyKey(reversalSnapshot.reversalFactId);

  try {
    return await attemptCreateCompensationTransaction({
      paymentOrder,
      originalCaptureTransaction,
      idempotencyKey,
      referenciaExterna: reversalSnapshot.reversalFactId,
      categoryKey: PAYPAL_REVERSAL_CATEGORY_KEY,
      descripcion: "Reversa PayPal de donacion unica",
      origenTipo: "PAYPAL_DONATION_REVERSAL",
      grossAmount: reversalSnapshot.grossAmount,
      currencyCode: reversalSnapshot.currencyCode,
      occurredAt: reversalSnapshot.createTime,
      metadata: {
        adjustment_type: "REVERSAL",
        paypal_order_id: paymentOrder.proveedor_orden_id,
        paypal_capture_id: reversalSnapshot.paypalCaptureId,
        paypal_reversal_id: reversalSnapshot.providerReversalId,
        paypal_event_id: reversalSnapshot.webhookEventId,
        original_transaction_id: originalCaptureTransaction.transaccion_id,
        original_capture_id: originalCaptureTransaction.referencia_externa,
        original_payment_order_id: paymentOrder.orden_pago_id,
        reversal_fact_id: reversalSnapshot.reversalFactId,
        capture_financials: buildCaptureFinancialMetadata(reversalSnapshot.captureFinancials),
        webhook_event_id: reversalSnapshot.webhookEventId,
        webhook_event_type: normalizeNullableString(webhookEvent?.event_type),
        reconciled_from: source,
      },
      source,
      adjustmentType: "REVERSAL",
      validateBeforeCreate: async (manager) => {
        await assertReversalCompensationIsAllowed(manager, {
          paymentOrder,
          originalCaptureTransaction,
          reversalSnapshot,
        });
      },
      markPaymentOrder: async (manager) => {
        const order = await getPaymentOrderWithRelations(manager, {
          orden_pago_id: paymentOrder.orden_pago_id,
        });

        order.metadata = mergeOrderMetadata(order, {
          paypal: {
            ...(order.metadata?.paypal || {}),
            order_id: order.proveedor_orden_id,
            capture_id: reversalSnapshot.paypalCaptureId,
            last_reversal_id: reversalSnapshot.reversalFactId,
            last_reversal_event_id: reversalSnapshot.webhookEventId,
            last_webhook_event: normalizeNullableString(webhookEvent?.event_type),
            updated_at: toIsoTimestamp(new Date()),
          },
          reversal_summary: {
            reversal_capture_id: reversalSnapshot.paypalCaptureId,
            reversal_fact_id: reversalSnapshot.reversalFactId,
            paypal_event_id: reversalSnapshot.webhookEventId,
            last_reconciled_from: source,
          },
        });

        await manager.getRepository(PaymentOrder).save(order);
        return order;
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const recoveredResponse = await finalizeExistingCompensationTransaction({
      paymentOrder,
      originalCaptureTransaction,
      idempotencyKey,
      referenciaExterna: reversalSnapshot.reversalFactId,
      categoryKey: PAYPAL_REVERSAL_CATEGORY_KEY,
      adjustmentType: "REVERSAL",
      currencyCode: reversalSnapshot.currencyCode,
      grossAmount: reversalSnapshot.grossAmount,
      metadata: null,
      source,
      validateBeforeCreate: async (manager) => {
        await assertReversalCompensationIsAllowed(manager, {
          paymentOrder,
          originalCaptureTransaction,
          reversalSnapshot,
        });
      },
      markPaymentOrder: async (manager) => {
        const order = await getPaymentOrderWithRelations(manager, {
          orden_pago_id: paymentOrder.orden_pago_id,
        });

        order.metadata = mergeOrderMetadata(order, {
          paypal: {
            ...(order.metadata?.paypal || {}),
            order_id: order.proveedor_orden_id,
            capture_id: reversalSnapshot.paypalCaptureId,
            last_reversal_id: reversalSnapshot.reversalFactId,
            last_reversal_event_id: reversalSnapshot.webhookEventId,
            last_webhook_event: normalizeNullableString(webhookEvent?.event_type),
            updated_at: toIsoTimestamp(new Date()),
          },
          reversal_summary: {
            reversal_capture_id: reversalSnapshot.paypalCaptureId,
            reversal_fact_id: reversalSnapshot.reversalFactId,
            paypal_event_id: reversalSnapshot.webhookEventId,
            last_reconciled_from: source,
          },
        });

        await manager.getRepository(PaymentOrder).save(order);
        return order;
      },
    });

    if (!recoveredResponse) {
      throw buildServiceError(
        "Ocurrio una carrera de idempotencia, pero no fue posible recuperar la reversa PayPal.",
        409,
      );
    }

    return recoveredResponse;
  }
}

export async function markPayPalDonationOrderApproved({
  paypalOrderId,
  payer = null,
  source = "webhook:CHECKOUT.ORDER.APPROVED",
}) {
  if (!paypalOrderId) return null;

  return AppDataSource.transaction(async (manager) => {
    const paymentOrder = await getPaymentOrderWithRelations(manager, {
      proveedor_orden_id: paypalOrderId,
    });

    if (!paymentOrder || paymentOrder.proposito !== DONATION_CATEGORY_KEY) {
      return null;
    }

    if (paymentOrder.estado === PAYMENT_ORDER_CREATED_STATE) {
      paymentOrder.estado = PAYMENT_ORDER_APPROVED_STATE;
    }

    const nextApprovedSnapshotCandidate = buildPayPalPayerCandidate(
      pickPayPalPayer(payer),
      {
        source: PAYPAL_PAYER_SNAPSHOT_SOURCE_VERIFIED_ORDER_APPROVED,
        orderId: paypalOrderId,
      },
    );

    paymentOrder.metadata = mergeOrderMetadata(paymentOrder, {
      paypal: {
        ...(paymentOrder.metadata?.paypal || {}),
        order_id: paypalOrderId,
        order_status: "APPROVED",
        updated_at: toIsoTimestamp(new Date()),
        ...mergeTrustedPayPalPayerSnapshot(paymentOrder.metadata?.paypal, nextApprovedSnapshotCandidate),
      },
      last_reconciled_from: source,
    });

    await manager.getRepository(PaymentOrder).save(paymentOrder);
    return paymentOrder;
  });
}

export async function markPayPalDonationCapturePending({
  paypalOrderId,
  captureId,
  eventType,
  source = "webhook:PAYMENT.CAPTURE.PENDING",
  status = "PENDING",
}) {
  if (!paypalOrderId) return null;

  return AppDataSource.transaction(async (manager) => {
    const paymentOrder = await getPaymentOrderWithRelations(manager, {
      proveedor_orden_id: paypalOrderId,
    });

    if (!paymentOrder || paymentOrder.proposito !== DONATION_CATEGORY_KEY) {
      return null;
    }

    paymentOrder.metadata = mergeOrderMetadata(paymentOrder, {
      paypal: {
        ...(paymentOrder.metadata?.paypal || {}),
        order_id: paypalOrderId,
        capture_id: captureId,
        capture_status: status,
        last_webhook_event: eventType,
        updated_at: toIsoTimestamp(new Date()),
      },
      pending_capture: {
        capture_id: captureId,
        status,
        event_type: eventType,
        last_reconciled_from: source,
      },
      last_reconciled_from: source,
    });

    await manager.getRepository(PaymentOrder).save(paymentOrder);
    return paymentOrder;
  });
}

export async function markPayPalDonationCaptureFailed({
  paypalOrderId,
  captureId,
  eventType,
  source,
  status,
}) {
  if (!paypalOrderId) return null;

  return AppDataSource.transaction(async (manager) => {
    const paymentOrder = await getPaymentOrderWithRelations(manager, {
      proveedor_orden_id: paypalOrderId,
    });

    if (!paymentOrder || paymentOrder.proposito !== DONATION_CATEGORY_KEY) {
      return null;
    }

    return updatePaymentOrderAsFailed(
      manager,
      paymentOrder,
      `Webhook ${eventType} con estado ${status || PAYMENT_ORDER_FAILED_STATE}.`,
      {
        capture_id: captureId,
        capture_status: status || PAYMENT_ORDER_FAILED_STATE,
        last_webhook_event: eventType,
        last_reconciled_from: source,
      },
    );
  });
}

export async function capturePayPalDonationOrderService(body) {
  try {
    const paymentOrder = await findPaymentOrderForCapture(body);
    let captureOrderPayload;

    try {
      captureOrderPayload = await capturePayPalOrder(paymentOrder.proveedor_orden_id);
    } catch (error) {
      if (isAlreadyCapturedPayPalError(error)) {
        captureOrderPayload = await getPayPalOrder(paymentOrder.proveedor_orden_id);
      } else {
        throw error;
      }
    }

    const captureOrderContext = extractCaptureOrderContext(captureOrderPayload);

    if (!captureOrderContext.paypalCaptureId) {
      if (
        PAYPAL_FAILED_CAPTURE_STATUSES.has(captureOrderContext.captureStatus)
        || PAYPAL_FAILED_CAPTURE_STATUSES.has(captureOrderContext.orderStatus)
      ) {
        await markPayPalDonationCaptureFailed({
          paypalOrderId: paymentOrder.proveedor_orden_id,
          captureId: captureOrderContext.paypalCaptureId,
          eventType: "CAPTURE_ORDER_RESPONSE",
          source: "capture-order",
          status: captureOrderContext.captureStatus || captureOrderContext.orderStatus,
        });
      }

      throw buildServiceError(
        "PayPal no devolvio un capture_id canonico para completar la conciliacion.",
        409,
      );
    }

    const canonicalCapture = await getPayPalCapture(captureOrderContext.paypalCaptureId);
    const reconciled = await reconcilePayPalDonationCapture({
      paypalOrderId: paymentOrder.proveedor_orden_id,
      capture: canonicalCapture,
      payer: captureOrderContext.payer,
      payerSource: PAYPAL_PAYER_SNAPSHOT_SOURCE_ORDER,
      source: "capture-order",
    });

    return [mapCaptureOrderPublicResult(reconciled), null];
  } catch (error) {
    if (error?.statusCode) {
      return [null, error];
    }

    if (error instanceof PayPalApiError) {
      return [null, buildServiceError(error.message, error.statusCode || 502)];
    }

    if (error.message === "Orden de pago no encontrada.") {
      return [null, buildServiceError(error.message, 404)];
    }

    return [null, buildServiceError(error.message || "Error al capturar la orden PayPal.", 400)];
  }
}

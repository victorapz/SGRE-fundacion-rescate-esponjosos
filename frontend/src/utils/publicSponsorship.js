import { buildAbsoluteApiAssetUrl } from "./publicApiAssets.js";
import { sanitizeRichTextHtml } from "./rich-text.js";

const PENDING_SPONSORSHIP_STORAGE_KEY = "public_sponsorship_pending";
const RESOLVED_SPONSORSHIP_STORAGE_KEY = "public_sponsorship_resolved";
const PENDING_SPONSORSHIP_TTL_MS = 30 * 60 * 1000;
const PENDING_SPONSORSHIP_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const PUBLIC_SPONSORSHIP_PENDING_STATES = new Set([
  "PENDIENTE_APROBACION",
  "CREADA",
  "APROBACION_PENDIENTE",
]);
const PUBLIC_SPONSORSHIP_ACTIVE_STATES = new Set(["ACTIVO", "ACTIVA"]);
const PUBLIC_SPONSORSHIP_FAILED_STATES = new Set([
  "CANCELADO",
  "CANCELADA",
  "EXPIRADA",
  "FALLIDA",
  "SUSPENDIDA",
  "SUSPENDIDO",
]);

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeNullableString(value) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeImageUrl(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const normalizedObjectUrl = normalizeNullableString(
      value.preview_url
      || value.public_url
      || value.url
      || value.src,
    );
    return normalizedObjectUrl ? buildAbsoluteApiAssetUrl(normalizedObjectUrl) : null;
  }

  const normalized = normalizeNullableString(value);
  return normalized ? buildAbsoluteApiAssetUrl(normalized) : null;
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeMoney(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePagination(payload = {}, fallbackLimit = 9) {
  return payload.pagination || {
    page: 1,
    limit: fallbackLimit,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };
}

function buildPublicSponsorshipConfigError(message) {
  const error = new Error("El servicio de apadrinamiento no esta disponible temporalmente.");
  error.code = "PUBLIC_SPONSORSHIP_CONFIG_ERROR";
  error.isConfigurationError = true;
  error.internalMessage = message;
  return error;
}

function getAllowedPayPalHosts() {
  const environment = typeof import.meta.env?.VITE_PAYPAL_ENV === "string"
    ? import.meta.env.VITE_PAYPAL_ENV.trim().toLowerCase()
    : "";

  if (!environment) {
    return import.meta.env?.DEV
      ? new Set(["www.sandbox.paypal.com", "sandbox.paypal.com"])
      : null;
  }

  if (environment === "sandbox") {
    return new Set(["www.sandbox.paypal.com", "sandbox.paypal.com"]);
  }

  if (environment === "live") {
    return new Set(["www.paypal.com", "paypal.com"]);
  }

  throw buildPublicSponsorshipConfigError("VITE_PAYPAL_ENV debe ser sandbox o live.");
}

export function normalizePublicSponsorshipAnimalListItem(item = {}) {
  return {
    id: normalizePositiveInteger(item?.id),
    nombre: normalizeNullableString(item?.nombre) || "Animal rescatado",
    especie: normalizeNullableString(item?.especie) || "",
    sexo: normalizeNullableString(item?.sexo) || "",
    imagen_principal: normalizeImageUrl(item?.imagen_principal),
  };
}

export function normalizePublicSponsorshipPlan(item = {}) {
  return {
    id: normalizePositiveInteger(item?.id),
    nombre: normalizeNullableString(item?.nombre) || "Plan mensual",
    descripcion: normalizeNullableString(item?.descripcion),
    monto: normalizeMoney(item?.monto),
    moneda: normalizeNullableString(item?.moneda) || "USD",
    frecuencia: normalizeNullableString(item?.frecuencia) || "Mensual",
  };
}

export function normalizePublicSponsorshipAnimalDetail(item = {}) {
  const profile = item?.perfil_publico && typeof item.perfil_publico === "object"
    ? item.perfil_publico
    : {};

  return {
    id: normalizePositiveInteger(item?.id),
    nombre: normalizeNullableString(item?.nombre) || "Animal rescatado",
    especie: normalizeNullableString(item?.especie) || "",
    sexo: normalizeNullableString(item?.sexo) || "",
    edad_aproximada: normalizeNullableString(item?.edad_aproximada),
    imagen_principal: normalizeImageUrl(item?.imagen_principal),
    galeria_publica: (Array.isArray(item?.galeria_publica) ? item.galeria_publica : [])
      .map(normalizeImageUrl)
      .filter(Boolean),
    historia: normalizeNullableString(profile?.historia),
    personalidad: normalizeNullableString(profile?.personalidad),
    gustos: normalizeNullableString(profile?.gustos),
    planes: (Array.isArray(item?.planes_activos) ? item.planes_activos : [])
      .map(normalizePublicSponsorshipPlan)
      .filter((plan) => plan.id),
  };
}

export function normalizePublicSponsorshipStatus(item = {}) {
  return {
    public_reference: normalizeNullableString(item?.public_reference),
    estado_apadrinamiento: normalizeNullableString(item?.estado_apadrinamiento),
    estado_suscripcion: normalizeNullableString(item?.estado_suscripcion),
    animal: item?.animal
      ? {
          id: normalizePositiveInteger(item.animal?.id),
          nombre: normalizeNullableString(item.animal?.nombre) || "Animal rescatado",
          imagen_principal: normalizeImageUrl(item.animal?.imagen_principal),
        }
      : null,
    plan: item?.plan
      ? {
          nombre: normalizeNullableString(item.plan?.nombre) || "Plan mensual",
          monto: normalizeMoney(item.plan?.monto),
          moneda: normalizeNullableString(item.plan?.moneda) || "USD",
        }
      : null,
  };
}

export function normalizePublicSponsorshipStatusResponse(payload = {}) {
  const rawStatus = payload?.data && typeof payload.data === "object"
    ? payload.data
    : payload;

  return normalizePublicSponsorshipStatus(rawStatus || {});
}

export function resolvePublicSponsorshipReference({
  refFromQuery = null,
  pendingReference = null,
  resolvedReference = null,
} = {}) {
  return normalizeNullableString(refFromQuery)
    || normalizeNullableString(pendingReference?.public_reference)
    || normalizeNullableString(resolvedReference?.publicReference)
    || normalizeNullableString(resolvedReference?.public_reference)
    || null;
}

export function resolvePublicSponsorshipAnimalId({
  pendingReference = null,
  queryAnimalId = null,
  status = null,
} = {}) {
  return normalizePositiveInteger(pendingReference?.animal_id)
    || normalizePositiveInteger(queryAnimalId)
    || normalizePositiveInteger(status?.animal?.id)
    || null;
}

export function normalizePublicSponsorshipAnimalsPayload(payload = {}, fallbackLimit = 9) {
  return {
    items: (Array.isArray(payload?.items) ? payload.items : [])
      .map(normalizePublicSponsorshipAnimalListItem)
      .filter((item) => item.id),
    pagination: normalizePagination(payload, fallbackLimit),
  };
}

export function normalizePublicSponsorshipPlansPayload(payload = []) {
  return (Array.isArray(payload) ? payload : [])
    .map(normalizePublicSponsorshipPlan)
    .filter((item) => item.id);
}

export function getPublicSponsorshipErrorMessage(error, fallbackMessage) {
  if (error?.isConfigurationError) {
    return "El servicio de apadrinamiento no esta disponible temporalmente.";
  }

  const details = error?.response?.data?.details;
  const messageCandidate = error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || (typeof details === "string" ? details : "")
    || fallbackMessage;
  const message = normalizeString(String(messageCandidate || ""));

  if (!message) {
    return fallbackMessage;
  }

  if (/network|timeout|tempor|ECONN|fetch/i.test(message)) {
    return "No pudimos conectar con el servicio de apadrinamiento en este momento.";
  }

  if (/sql|query|stack|typeorm|constraint|column|axios/i.test(message)) {
    return fallbackMessage;
  }

  if (/duplicad|activo o pendiente/i.test(message)) {
    return "Ya existe un apadrinamiento activo o pendiente para este padrino y animal.";
  }

  if (/paypal/i.test(message) && /confirm/i.test(message)) {
    return "PayPal todavia esta confirmando este apadrinamiento. Intenta nuevamente en unos segundos.";
  }

  return message;
}

export function buildPublicSponsorshipRichTextHtml(value) {
  return sanitizeRichTextHtml(value);
}

export function validatePublicSponsorshipApprovalUrl(approvalUrl) {
  if (typeof approvalUrl !== "string" || !approvalUrl.trim()) {
    throw new Error("No pudimos iniciar la aprobacion segura con PayPal.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(approvalUrl.trim());
  } catch {
    throw new Error("La aprobacion de PayPal recibida no es valida.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("La aprobacion de PayPal recibida no es segura.");
  }

  if (parsedUrl.username || parsedUrl.password || (parsedUrl.port && parsedUrl.port !== "443")) {
    throw new Error("La aprobacion de PayPal recibida no es valida.");
  }

  const allowedHosts = getAllowedPayPalHosts();
  if (!allowedHosts?.has(parsedUrl.hostname)) {
    throw new Error("La aprobacion de PayPal recibida no pertenece a un dominio permitido.");
  }

  return parsedUrl.toString();
}

export function getPublicSponsorshipPendingStatePhase(status = {}) {
  const sponsorshipState = normalizeNullableString(status?.estado_apadrinamiento);
  const subscriptionState = normalizeNullableString(status?.estado_suscripcion);

  if (
    PUBLIC_SPONSORSHIP_ACTIVE_STATES.has(sponsorshipState)
    || PUBLIC_SPONSORSHIP_ACTIVE_STATES.has(subscriptionState)
  ) {
    return "active";
  }

  if (
    PUBLIC_SPONSORSHIP_FAILED_STATES.has(sponsorshipState)
    || PUBLIC_SPONSORSHIP_FAILED_STATES.has(subscriptionState)
  ) {
    return "failed";
  }

  if (
    PUBLIC_SPONSORSHIP_PENDING_STATES.has(sponsorshipState)
    || PUBLIC_SPONSORSHIP_PENDING_STATES.has(subscriptionState)
  ) {
    return "pending";
  }

  return "unknown";
}

export function createPublicSponsorshipIdempotencyKey() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (!randomUuid) {
    throw buildPublicSponsorshipConfigError("crypto.randomUUID no esta disponible.");
  }

  return randomUuid;
}

function normalizeStoredTimestamp(timestamp) {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp;
  }

  if (typeof timestamp === "string" && timestamp.trim()) {
    const parsed = Date.parse(timestamp);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isStoredPendingStateExpired(timestamp) {
  const now = Date.now();

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  if (timestamp > now + PENDING_SPONSORSHIP_FUTURE_TOLERANCE_MS) {
    return true;
  }

  return now - timestamp > PENDING_SPONSORSHIP_TTL_MS;
}

export function storePendingPublicSponsorship(payload) {
  if (typeof window === "undefined") {
    return;
  }

  clearResolvedPublicSponsorship();
  window.sessionStorage.setItem(
    PENDING_SPONSORSHIP_STORAGE_KEY,
    JSON.stringify({
      public_reference: normalizeNullableString(payload?.public_reference),
      animal_id: normalizePositiveInteger(payload?.animal_id),
      idempotency_key: normalizeNullableString(payload?.idempotency_key),
      timestamp: Date.now(),
    }),
  );
}

export function readPendingPublicSponsorship() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(PENDING_SPONSORSHIP_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const timestamp = normalizeStoredTimestamp(parsed?.timestamp);

    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || !normalizeNullableString(parsed?.public_reference)
      || !normalizeNullableString(parsed?.idempotency_key)
      || !normalizePositiveInteger(parsed?.animal_id)
      || !timestamp
      || isStoredPendingStateExpired(timestamp)
    ) {
      clearPendingPublicSponsorship();
      return null;
    }

    return {
      public_reference: normalizeNullableString(parsed.public_reference),
      animal_id: normalizePositiveInteger(parsed.animal_id),
      idempotency_key: normalizeNullableString(parsed.idempotency_key),
      timestamp,
    };
  } catch {
    clearPendingPublicSponsorship();
    return null;
  }
}

export function clearPendingPublicSponsorship() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_SPONSORSHIP_STORAGE_KEY);
}

export function storeResolvedPublicSponsorship(status) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    RESOLVED_SPONSORSHIP_STORAGE_KEY,
    JSON.stringify({
      status: normalizePublicSponsorshipStatus(status),
      timestamp: Date.now(),
    }),
  );
}

export function readResolvedPublicSponsorship() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(RESOLVED_SPONSORSHIP_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const timestamp = normalizeStoredTimestamp(parsed?.timestamp);

    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || !timestamp
      || isStoredPendingStateExpired(timestamp)
    ) {
      clearResolvedPublicSponsorship();
      return null;
    }

    return normalizePublicSponsorshipStatus(parsed.status || {});
  } catch {
    clearResolvedPublicSponsorship();
    return null;
  }
}

export function clearResolvedPublicSponsorship() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(RESOLVED_SPONSORSHIP_STORAGE_KEY);
}

export function getOrCreateAttemptIdempotencyKey(currentKey) {
  const normalizedCurrentKey = normalizeNullableString(currentKey);
  return normalizedCurrentKey || createPublicSponsorshipIdempotencyKey();
}

export function buildInitialSponsorshipFormState() {
  return {
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    consentimiento_datos: false,
  };
}

export function validatePublicSponsorshipForm(values = {}, selectedPlanId) {
  const errors = {};

  if (!normalizeString(values?.nombre)) {
    errors.nombre = "Ingresa tu nombre.";
  }

  if (!normalizeString(values?.apellido)) {
    errors.apellido = "Ingresa tu apellido.";
  }

  const normalizedEmail = normalizeString(values?.email);
  if (!normalizedEmail) {
    errors.email = "Ingresa tu correo electrónico.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizedEmail)) {
    errors.email = "Ingresa un correo electrónico valido.";
  }

  if (!normalizePositiveInteger(selectedPlanId)) {
    errors.plan_id = "Selecciona un plan de apadrinamiento.";
  }

  if (values?.consentimiento_datos !== true) {
    errors.consentimiento_datos = "Debes aceptar el tratamiento de datos para continuar.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export {
  PENDING_SPONSORSHIP_STORAGE_KEY,
  PENDING_SPONSORSHIP_TTL_MS,
  RESOLVED_SPONSORSHIP_STORAGE_KEY,
};

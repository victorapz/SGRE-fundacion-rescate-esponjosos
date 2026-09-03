const PUBLIC_DONATION_CONFIG_UNAVAILABLE_MESSAGE =
  "El servicio de donaciones no esta disponible temporalmente.";
const DEFAULT_LOCAL_API_URL = "http://localhost:3000/api";
const PAYPAL_ENVIRONMENTS = new Set(["sandbox", "live"]);
const PAYPAL_HOSTS_BY_ENV = {
  sandbox: new Set(["www.sandbox.paypal.com", "sandbox.paypal.com"]),
  live: new Set(["www.paypal.com", "paypal.com"]),
};
const PUBLIC_DONATION_SESSION_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const PENDING_DONATION_STORAGE_KEY = "public-paypal-donation:pending-order";
export const PUBLIC_DONATION_SESSION_TTL_MS = 30 * 60 * 1000;

function buildPublicDonationConfigError(internalMessage) {
  const error = new Error(PUBLIC_DONATION_CONFIG_UNAVAILABLE_MESSAGE);
  error.code = "PUBLIC_DONATION_CONFIG_ERROR";
  error.isConfigurationError = true;
  error.internalMessage = internalMessage;
  return error;
}

function reportPublicDonationConfigError(error) {
  if (!import.meta.env?.DEV) {
    return;
  }

  const diagnosticMessage = error?.internalMessage || error?.message;
  console.error("[public-donation-config]", diagnosticMessage);
}

function normalizeConfiguredUrl(rawValue, label, { allowHttp = false } = {}) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw buildPublicDonationConfigError(`${label} no esta configurada.`);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(rawValue.trim());
  } catch {
    throw buildPublicDonationConfigError(`${label} debe ser una URL absoluta valida.`);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw buildPublicDonationConfigError(`${label} debe usar HTTP o HTTPS.`);
  }

  if (parsedUrl.protocol === "http:" && !allowHttp) {
    throw buildPublicDonationConfigError(`${label} debe usar HTTPS fuera de desarrollo.`);
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw buildPublicDonationConfigError(`${label} no puede incluir credenciales.`);
  }

  parsedUrl.pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

  return parsedUrl.toString().replace(/\/$/, "");
}

export function getPublicDonationServiceUnavailableMessage() {
  return PUBLIC_DONATION_CONFIG_UNAVAILABLE_MESSAGE;
}

export function getConfiguredApiBaseUrl() {
  const configuredApiUrl = import.meta.env?.VITE_API_URL;

  try {
    if (!configuredApiUrl) {
      if (import.meta.env?.DEV) {
        return normalizeConfiguredUrl(DEFAULT_LOCAL_API_URL, "VITE_API_URL", {
          allowHttp: true,
        });
      }

      throw buildPublicDonationConfigError(
        "VITE_API_URL es obligatoria fuera de desarrollo.",
      );
    }

    return normalizeConfiguredUrl(configuredApiUrl, "VITE_API_URL", {
      allowHttp: Boolean(import.meta.env?.DEV),
    });
  } catch (error) {
    reportPublicDonationConfigError(error);
    throw error;
  }
}

export function getConfiguredPayPalEnvironment() {
  const configuredEnvironment = typeof import.meta.env?.VITE_PAYPAL_ENV === "string"
    ? import.meta.env.VITE_PAYPAL_ENV.trim().toLowerCase()
    : "";

  try {
    if (!configuredEnvironment) {
      if (import.meta.env?.DEV) {
        return "sandbox";
      }

      throw buildPublicDonationConfigError(
        "VITE_PAYPAL_ENV es obligatoria fuera de desarrollo.",
      );
    }

    if (!PAYPAL_ENVIRONMENTS.has(configuredEnvironment)) {
      throw buildPublicDonationConfigError(
        "VITE_PAYPAL_ENV debe ser sandbox o live.",
      );
    }

    return configuredEnvironment;
  } catch (error) {
    reportPublicDonationConfigError(error);
    throw error;
  }
}

export function getAllowedPayPalHosts() {
  const paypalEnvironment = getConfiguredPayPalEnvironment();
  return PAYPAL_HOSTS_BY_ENV[paypalEnvironment];
}

export function validatePayPalApprovalUrl(approvalUrl) {
  if (typeof approvalUrl !== "string" || !approvalUrl.trim()) {
    throw new Error("No pudimos iniciar el pago seguro. Intenta nuevamente.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(approvalUrl);
  } catch {
    throw new Error("La aprobacion de PayPal recibida no es valida.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("La aprobacion de PayPal recibida no es segura.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("La aprobacion de PayPal recibida no es valida.");
  }

  if (parsedUrl.port && parsedUrl.port !== "443") {
    throw new Error("La aprobacion de PayPal recibida no es valida.");
  }

  if (!getAllowedPayPalHosts().has(parsedUrl.hostname)) {
    throw new Error("La aprobacion de PayPal recibida no pertenece a un dominio permitido.");
  }

  return parsedUrl.toString();
}

export function isValidPayPalOrderToken(token) {
  return typeof token === "string" && /^[A-Z0-9-]{10,255}$/i.test(token.trim());
}

export function normalizeMoneyInput(rawValue) {
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.replace(",", ".").replace(/[^\d.]/g, "");
}

export function parseDonationAmount(rawValue) {
  if (typeof rawValue !== "string") {
    return { valid: false, amount: null, message: "Ingresa un monto valido." };
  }

  const normalizedValue = rawValue.trim();

  if (!normalizedValue) {
    return { valid: false, amount: null, message: "Ingresa un monto para continuar." };
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue)) {
    return {
      valid: false,
      amount: null,
      message: "Ingresa un monto valido con hasta 2 decimales.",
    };
  }

  const amount = Number(normalizedValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, amount: null, message: "El monto debe ser mayor a 0." };
  }

  return { valid: true, amount, message: "" };
}

export function storePendingDonationOrder(payload) {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(
    PENDING_DONATION_STORAGE_KEY,
    JSON.stringify({
      ...payload,
      timestamp: Number(payload?.timestamp) || Date.now(),
    }),
  );
}

function clearPendingDonationOrderFromWindow(targetWindow) {
  targetWindow.sessionStorage.removeItem(PENDING_DONATION_STORAGE_KEY);
}

function normalizePendingDonationTimestamp(timestamp) {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp;
  }

  if (typeof timestamp === "string" && timestamp.trim()) {
    const parsedTimestamp = Date.parse(timestamp);
    return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
  }

  return null;
}

function isPendingDonationOrderExpired(timestamp) {
  const now = Date.now();

  if (!Number.isFinite(timestamp)) {
    return true;
  }

  if (timestamp > now + PUBLIC_DONATION_SESSION_FUTURE_TOLERANCE_MS) {
    return true;
  }

  return now - timestamp > PUBLIC_DONATION_SESSION_TTL_MS;
}

export function readPendingDonationOrder(expectedPayPalOrderId = null) {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = window.sessionStorage.getItem(PENDING_DONATION_STORAGE_KEY);
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue);
    const normalizedTimestamp = normalizePendingDonationTimestamp(parsedValue?.timestamp);

    if (
      !parsedValue
      || typeof parsedValue !== "object"
      || Array.isArray(parsedValue)
      || !parsedValue.paypal_order_id
      || !normalizedTimestamp
      || isPendingDonationOrderExpired(normalizedTimestamp)
    ) {
      clearPendingDonationOrderFromWindow(window);
      return null;
    }

    if (
      expectedPayPalOrderId
      && String(parsedValue.paypal_order_id).trim() !== String(expectedPayPalOrderId).trim()
    ) {
      clearPendingDonationOrderFromWindow(window);
      return null;
    }

    return {
      paypal_order_id: String(parsedValue.paypal_order_id).trim(),
      monto: parsedValue.monto ?? null,
      moneda: parsedValue.moneda ?? null,
      anonymous: Boolean(parsedValue.anonymous),
      timestamp: normalizedTimestamp,
    };
  } catch {
    clearPendingDonationOrderFromWindow(window);
    return null;
  }
}

export function clearPendingDonationOrder() {
  if (typeof window === "undefined") return;
  clearPendingDonationOrderFromWindow(window);
}

export function getPublicDonationErrorMessage(error, fallbackMessage) {
  if (error?.isConfigurationError) {
    return PUBLIC_DONATION_CONFIG_UNAVAILABLE_MESSAGE;
  }

  const rawMessage = error?.response?.data?.details
    || error?.response?.data?.message
    || error?.message
    || fallbackMessage;

  const message = String(rawMessage || "").trim();

  if (!message) {
    return fallbackMessage;
  }

  if (/network|timeout|tempor|ECONN|fetch/i.test(message)) {
    return "No pudimos confirmar la operación en este momento. Intenta nuevamente.";
  }

  if (/sql|query|stack|typeorm|constraint|column/i.test(message)) {
    return fallbackMessage;
  }

  return message;
}

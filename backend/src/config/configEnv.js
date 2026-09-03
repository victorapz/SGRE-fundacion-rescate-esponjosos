"use strict";

import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

const PRIMARY_ENV_FILE_PATH = path.resolve(_dirname, "../../.env");
const LEGACY_ENV_FILE_PATH = path.resolve(_dirname, ".env");

export const envFilePath = fs.existsSync(PRIMARY_ENV_FILE_PATH)
  ? PRIMARY_ENV_FILE_PATH
  : LEGACY_ENV_FILE_PATH;

dotenv.config({ path: envFilePath });

function toBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === "true";
}

function toNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function toList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAbsoluteOrigin(value, envName) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${envName} debe ser una URL absoluta valida.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${envName} debe usar HTTP o HTTPS.`);
  }

  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
}

function ensureAbsoluteUrl(value, { envName } = {}) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${envName} debe ser una URL absoluta valida.`);
  }

  const isLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(isLocalhost && parsed.protocol === "http:")) {
    throw new Error(`${envName} debe usar HTTPS salvo en localhost.`);
  }

  return parsed.toString();
}

function optionalAbsoluteUrl(value, { envName } = {}) {
  if (!String(value || "").trim()) {
    return "";
  }

  return ensureAbsoluteUrl(value, { envName });
}

function buildPublicUrl(baseUrl, suffix) {
  if (!String(baseUrl || "").trim()) {
    return "";
  }

  return `${String(baseUrl).replace(/\/+$/, "")}${suffix}`;
}

export const NODE_ENV = process.env.NODE_ENV || "development";
export const PORT = toNumber(process.env.PORT, 3000);
export const APP_HOST = process.env.APP_HOST || "0.0.0.0";
export const HOST = APP_HOST;

export const DB_HOST = process.env.DB_HOST || process.env.HOST || "127.0.0.1";
export const DB_PORT = toNumber(process.env.DB_PORT, 5432);
export const DB_DATABASE = process.env.DB_DATABASE || process.env.DATABASE || "";
export const DB_USERNAME = process.env.DB_USERNAME || "";
export const DB_PASSWORD = process.env.DB_PASSWORD ?? process.env.PASSWORD ?? "";

export const DATABASE = DB_DATABASE;
export const PASSWORD = DB_PASSWORD;

export const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "";
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
export const AUTH_REFRESH_COOKIE_NAME = process.env.AUTH_REFRESH_COOKIE_NAME || "refreshToken";
export const AUTH_REFRESH_COOKIE_PATH = process.env.AUTH_REFRESH_COOKIE_PATH || "/api/auth";
export const AUTH_REFRESH_COOKIE_SAME_SITE = process.env.AUTH_REFRESH_COOKIE_SAME_SITE || "lax";
export const AUTH_REFRESH_COOKIE_SECURE = process.env.AUTH_REFRESH_COOKIE_SECURE || "";
export const AUTH_REFRESH_COOKIE_DOMAIN = process.env.AUTH_REFRESH_COOKIE_DOMAIN || "";
export const SHIFT_CAPACITY = Number(process.env.SHIFT_CAPACITY ?? 5);
export const SCHEDULER_TZ = process.env.SCHEDULER_TZ;
export const SEED_DEMO_DATA = toBoolean(process.env.SEED_DEMO_DATA, false);
export const DEMO_SEED_PASSWORD = process.env.DEMO_SEED_PASSWORD || "";
export const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "";
export const SEED_VOLUNTEER_PASSWORD = process.env.SEED_VOLUNTEER_PASSWORD || "";
export const SEED_AREA_MANAGER_PASSWORD = process.env.SEED_AREA_MANAGER_PASSWORD || "";
export const SEED_INVENTORY_LOCAL_PASSWORD = process.env.SEED_INVENTORY_LOCAL_PASSWORD || "";

export const TRUST_PROXY = process.env.TRUST_PROXY || "loopback";
export const CORS_ALLOW_CREDENTIALS = toBoolean(process.env.CORS_ALLOW_CREDENTIALS, true);
export const CORS_ALLOWED_ORIGINS = toList(process.env.CORS_ALLOWED_ORIGINS);

export const PUBLIC_FRONTEND_URL = process.env.PUBLIC_FRONTEND_URL
  || (NODE_ENV === "production" ? "" : "http://localhost:5173");
export const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || "";

export function getAllowedCorsOrigins() {
  const explicitOrigins = CORS_ALLOWED_ORIGINS.length > 0
    ? CORS_ALLOWED_ORIGINS.map((origin) => normalizeAbsoluteOrigin(origin, "CORS_ALLOWED_ORIGINS"))
    : [];

  if (explicitOrigins.length > 0) {
    return explicitOrigins;
  }

  if (NODE_ENV === "production") {
    return PUBLIC_FRONTEND_URL
      ? [normalizeAbsoluteOrigin(PUBLIC_FRONTEND_URL, "PUBLIC_FRONTEND_URL")]
      : [];
  }

  return [
    PUBLIC_FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ]
    .filter(Boolean)
    .map((origin) => normalizeAbsoluteOrigin(origin, "PUBLIC_FRONTEND_URL"));
}

export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "";
export const MINIO_PORT = toNumber(process.env.MINIO_PORT, 9000);
export const MINIO_USE_SSL = toBoolean(process.env.MINIO_USE_SSL, false);
export const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "";
export const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || "";
export const MINIO_BUCKET = process.env.MINIO_BUCKET || "";
export const MINIO_BUCKET_PRIVATE = process.env.MINIO_BUCKET_PRIVATE || MINIO_BUCKET || "";
export const MINIO_BUCKET_PUBLIC = process.env.MINIO_BUCKET_PUBLIC || MINIO_BUCKET || "";
export const MINIO_PRESIGNED_EXPIRATION = toNumber(process.env.MINIO_PRESIGNED_EXPIRATION, 900);

export const FILE_MAX_SIZE_MB = toNumber(process.env.FILE_MAX_SIZE_MB, 10);
export const FILE_ALLOWED_IMAGE_MIME = process.env.FILE_ALLOWED_IMAGE_MIME || "image/jpeg,image/png,image/webp";
export const FILE_ALLOWED_DOCUMENT_MIME = process.env.FILE_ALLOWED_DOCUMENT_MIME || "application/pdf,image/jpeg,image/png,image/webp";
export const FILE_ALLOWED_IMAGE_MIME_LIST = toList(FILE_ALLOWED_IMAGE_MIME);
export const FILE_ALLOWED_DOCUMENT_MIME_LIST = toList(FILE_ALLOWED_DOCUMENT_MIME);
export const FILE_PUBLIC_DELIVERY_MODE = process.env.FILE_PUBLIC_DELIVERY_MODE || "proxy";

export const PAYPAL_MODE = process.env.PAYPAL_MODE || "sandbox";
export const PAYPAL_BASE_URL = process.env.PAYPAL_BASE_URL
  || (PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com");
export const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
export const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
export const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || "USD").trim().toUpperCase();
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || "";
export const PAYPAL_REQUEST_TIMEOUT_MS = toNumber(process.env.PAYPAL_REQUEST_TIMEOUT_MS, 10000);
export const PAYPAL_DONATION_SUCCESS_URL = optionalAbsoluteUrl(
  process.env.PAYPAL_DONATION_SUCCESS_URL || buildPublicUrl(PUBLIC_FRONTEND_URL, "/donacion/success"),
  { envName: "PAYPAL_DONATION_SUCCESS_URL" },
);
export const PAYPAL_DONATION_CANCEL_URL = optionalAbsoluteUrl(
  process.env.PAYPAL_DONATION_CANCEL_URL || buildPublicUrl(PUBLIC_FRONTEND_URL, "/donacion/cancel"),
  { envName: "PAYPAL_DONATION_CANCEL_URL" },
);
export const PAYPAL_SUBSCRIPTION_RETURN_URL = optionalAbsoluteUrl(
  process.env.PAYPAL_SUBSCRIPTION_RETURN_URL || buildPublicUrl(PUBLIC_FRONTEND_URL, "/apadrinamiento/success"),
  { envName: "PAYPAL_SUBSCRIPTION_RETURN_URL" },
);
export const PAYPAL_SUBSCRIPTION_CANCEL_URL = optionalAbsoluteUrl(
  process.env.PAYPAL_SUBSCRIPTION_CANCEL_URL || buildPublicUrl(PUBLIC_FRONTEND_URL, "/apadrinamiento/cancel"),
  { envName: "PAYPAL_SUBSCRIPTION_CANCEL_URL" },
);
export const PAYPAL_SUBSCRIPTION_BRAND_NAME = String(
  process.env.PAYPAL_SUBSCRIPTION_BRAND_NAME || "Fundacion Rescate Esponjosos",
).trim() || "Fundacion Rescate Esponjosos";

function buildMissingEnvError(variableName) {
  return new Error(`Falta la variable de entorno obligatoria: ${variableName}`);
}

export function validateRuntimeEnv() {
  const requiredVariables = NODE_ENV === "production"
    ? [
        ["PORT", process.env.PORT],
        ["DB_HOST", process.env.DB_HOST],
        ["DB_PORT", process.env.DB_PORT],
        ["DB_DATABASE", process.env.DB_DATABASE],
        ["DB_USERNAME", process.env.DB_USERNAME],
        ["DB_PASSWORD", process.env.DB_PASSWORD],
        ["ACCESS_TOKEN_SECRET", process.env.ACCESS_TOKEN_SECRET],
        ["REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET],
      ]
    : [
        ["PORT", process.env.PORT],
        ["DB_HOST", process.env.DB_HOST || process.env.HOST],
        ["DB_PORT", process.env.DB_PORT || "5432"],
        ["DB_DATABASE", process.env.DB_DATABASE || process.env.DATABASE],
        ["DB_USERNAME", process.env.DB_USERNAME],
        ["DB_PASSWORD", process.env.DB_PASSWORD ?? process.env.PASSWORD],
        ["ACCESS_TOKEN_SECRET", process.env.ACCESS_TOKEN_SECRET],
        ["REFRESH_TOKEN_SECRET", process.env.REFRESH_TOKEN_SECRET],
      ];

  const missingRequired = requiredVariables.find(([, value]) => !String(value || "").trim());
  if (missingRequired) {
    throw buildMissingEnvError(missingRequired[0]);
  }

  if (!Number.isInteger(PORT) || PORT <= 0) {
    throw new Error("PORT debe ser un entero mayor a 0.");
  }

  if (!Number.isInteger(DB_PORT) || DB_PORT <= 0) {
    throw new Error("DB_PORT debe ser un entero mayor a 0.");
  }

  if (NODE_ENV === "production" && getAllowedCorsOrigins().length === 0) {
    throw buildMissingEnvError("CORS_ALLOWED_ORIGINS");
  }
}

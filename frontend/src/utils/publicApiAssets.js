import { getConfiguredApiBaseUrl } from "./publicDonation.js";

const API_PREFIX_REGEX = /^\/api(?=\/)/i;

function getApiBaseUrlSafe() {
  try {
    return getConfiguredApiBaseUrl();
  } catch {
    return null;
  }
}

function stripApiPrefix(pathname = "") {
  const normalizedPath = String(pathname || "").trim();
  return normalizedPath.replace(API_PREFIX_REGEX, "") || "/";
}

function buildUrlFromApiBase(pathname) {
  const apiBaseUrl = getApiBaseUrlSafe();
  if (!apiBaseUrl) {
    return null;
  }

  const pathWithoutApiPrefix = stripApiPrefix(pathname);
  try {
    return new URL(`.${pathWithoutApiPrefix.startsWith("/") ? pathWithoutApiPrefix : `/${pathWithoutApiPrefix}`}`, `${apiBaseUrl.replace(/\/+$/, "")}/`).toString();
  } catch {
    return null;
  }
}

export function buildAbsoluteApiAssetUrl(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  const normalizedValue = rawValue.trim();

  try {
    const parsedUrl = new URL(normalizedValue);
    if (parsedUrl.pathname.startsWith("/api/")) {
      return buildUrlFromApiBase(parsedUrl.pathname + parsedUrl.search + parsedUrl.hash)
        || parsedUrl.toString();
    }

    return parsedUrl.toString();
  } catch {
    if (normalizedValue.startsWith("/api/")) {
      return buildUrlFromApiBase(normalizedValue) || normalizedValue;
    }

    if (normalizedValue.startsWith("/public/")) {
      return buildUrlFromApiBase(normalizedValue) || normalizedValue;
    }

    return normalizedValue;
  }
}

export function normalizePublicApiClientUrl(rawValue) {
  const absoluteUrl = buildAbsoluteApiAssetUrl(rawValue);
  if (!absoluteUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(absoluteUrl);
    if (parsedUrl.pathname.startsWith("/api/")) {
      return stripApiPrefix(parsedUrl.pathname) + parsedUrl.search + parsedUrl.hash;
    }

    return parsedUrl.toString();
  } catch {
    return String(absoluteUrl || "").replace(API_PREFIX_REGEX, "") || null;
  }
}

export function isApiAssetUrl(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(rawValue.trim(), "https://example.local");
    return parsedUrl.pathname.startsWith("/api/public/files/")
      || parsedUrl.pathname.startsWith("/api/public/notices/")
      || parsedUrl.pathname.startsWith("/public/files/")
      || parsedUrl.pathname.startsWith("/public/notices/");
  } catch {
    return false;
  }
}

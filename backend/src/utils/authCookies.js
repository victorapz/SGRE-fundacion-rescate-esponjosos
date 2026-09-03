"use strict";

import {
  AUTH_REFRESH_COOKIE_DOMAIN,
  AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_PATH,
  AUTH_REFRESH_COOKIE_SAME_SITE,
  AUTH_REFRESH_COOKIE_SECURE,
  NODE_ENV,
} from "../config/configEnv.js";
import { getRefreshTokenMaxAgeMs } from "./authTokens.js";

const VALID_SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim().toLowerCase() === "true";
}

function normalizeSameSite(value) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!VALID_SAME_SITE_VALUES.has(normalizedValue)) {
    throw new Error("AUTH_REFRESH_COOKIE_SAME_SITE debe ser lax, strict o none.");
  }

  return normalizedValue;
}

function parseCookieHeader(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());

      accumulator[key] = value;
      return accumulator;
    }, {});
}

export function getRefreshTokenCookieOptions() {
  const secureOverride = parseBoolean(AUTH_REFRESH_COOKIE_SECURE);
  const secure = secureOverride ?? NODE_ENV === "production";
  const sameSite = normalizeSameSite(AUTH_REFRESH_COOKIE_SAME_SITE);

  if (sameSite === "none" && !secure) {
    throw new Error("AUTH_REFRESH_COOKIE_SAME_SITE=none requiere AUTH_REFRESH_COOKIE_SECURE=true.");
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: AUTH_REFRESH_COOKIE_PATH,
    maxAge: getRefreshTokenMaxAgeMs(),
  };

  if (AUTH_REFRESH_COOKIE_DOMAIN) {
    options.domain = AUTH_REFRESH_COOKIE_DOMAIN;
  }

  return options;
}

export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(AUTH_REFRESH_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(AUTH_REFRESH_COOKIE_NAME, getRefreshTokenCookieOptions());
}

export function readRefreshTokenFromRequest(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);
  return cookies[AUTH_REFRESH_COOKIE_NAME] || null;
}

"use strict";

import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET,
} from "../config/configEnv.js";

const DURATION_MULTIPLIERS_MS = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function parseDurationToMs(value, label) {
  const normalizedValue = String(value || "").trim().toLowerCase();
  const match = normalizedValue.match(/^(\d+)(ms|s|m|h|d)$/);

  if (!match) {
    throw new Error(`${label} debe usar un formato valido como 15m, 1h o 7d.`);
  }

  const [, rawAmount, unit] = match;
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} debe ser mayor a 0.`);
  }

  return amount * DURATION_MULTIPLIERS_MS[unit];
}

export function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function expiresAtFromToken(token) {
  const payload = jwt.decode(token);

  if (!payload?.exp) {
    throw new Error("No se pudo determinar expiracion del token.");
  }

  return new Date(payload.exp * 1000);
}

export function ensureAuthSecrets() {
  if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error("Faltan ACCESS_TOKEN_SECRET o REFRESH_TOKEN_SECRET en variables de entorno");
  }
}

export function getRefreshTokenMaxAgeMs() {
  return parseDurationToMs(REFRESH_TOKEN_EXPIRES_IN, "REFRESH_TOKEN_EXPIRES_IN");
}

export function issueAccessToken(userId, roleName, roles = [], permissions = []) {
  return jwt.sign(
    {
      sub: userId,
      role: roleName,
      roles,
      permissions,
      type: "access",
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

export function issueRefreshToken(userId, familyId) {
  const tokenId = crypto.randomUUID();
  const refreshToken = jwt.sign(
    {
      sub: userId,
      familyId,
      tokenId,
      type: "refresh",
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
  );

  return {
    refreshToken,
    tokenId,
    tokenHash: tokenHash(refreshToken),
    expiresAt: expiresAtFromToken(refreshToken),
  };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET, {
    algorithms: ["HS256"],
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET, {
    algorithms: ["HS256"],
  });
}

"use strict";

import assert from "node:assert/strict";
import test from "node:test";

process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRES_IN ||= "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN ||= "7d";
process.env.AUTH_REFRESH_COOKIE_NAME ||= "refreshToken";
process.env.AUTH_REFRESH_COOKIE_PATH ||= "/api/auth";
process.env.AUTH_REFRESH_COOKIE_SAME_SITE ||= "lax";
process.env.AUTH_REFRESH_COOKIE_SECURE ||= "false";

const authCookies = await import(
  new URL("./authCookies.js?auth-cookies-test", import.meta.url),
);

test("auth cookies generan opciones coherentes y reutilizables para set/clear", () => {
  const options = authCookies.getRefreshTokenCookieOptions();

  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/api/auth");
  assert.equal(typeof options.maxAge, "number");
  assert.ok(options.maxAge > 0);
});

test("auth cookies leen la cookie de refresh y reutilizan las mismas opciones al limpiar", () => {
  const calls = [];
  const res = {
    cookie(name, value, options) {
      calls.push(["cookie", name, value, options]);
    },
    clearCookie(name, options) {
      calls.push(["clearCookie", name, options]);
    },
  };

  authCookies.setRefreshTokenCookie(res, "refresh-token-value");
  authCookies.clearRefreshTokenCookie(res);

  const readToken = authCookies.readRefreshTokenFromRequest({
    headers: {
      cookie: "other=123; refreshToken=refresh-token-value",
    },
  });

  assert.equal(readToken, "refresh-token-value");
  assert.equal(calls[0][0], "cookie");
  assert.equal(calls[0][1], "refreshToken");
  assert.equal(calls[1][0], "clearCookie");
  assert.deepEqual(calls[0][3], calls[1][2]);
});

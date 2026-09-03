"use strict";

import assert from "node:assert/strict";
import test from "node:test";

process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.ACCESS_TOKEN_EXPIRES_IN ||= "15m";
process.env.REFRESH_TOKEN_EXPIRES_IN ||= "7d";

const authTokens = await import(
  new URL("./authTokens.js?auth-tokens-test", import.meta.url),
);

test("auth tokens emiten tipos correctos y separan access de refresh", () => {
  const accessToken = authTokens.issueAccessToken(
    41,
    "ADMIN",
    ["ADMIN"],
    ["user:read"],
  );
  const refreshToken = authTokens.issueRefreshToken(41, "family-1").refreshToken;

  const decodedAccess = authTokens.verifyAccessToken(accessToken);
  const decodedRefresh = authTokens.verifyRefreshToken(refreshToken);

  assert.equal(decodedAccess.type, "access");
  assert.equal(decodedRefresh.type, "refresh");
  assert.equal(typeof decodedRefresh.familyId, "string");

  assert.throws(() => authTokens.verifyRefreshToken(accessToken));
  assert.throws(() => authTokens.verifyAccessToken(refreshToken));
});

test("auth tokens calculan max-age del refresh desde la expiracion configurada", () => {
  assert.equal(authTokens.getRefreshTokenMaxAgeMs(), 7 * 24 * 60 * 60 * 1000);
});

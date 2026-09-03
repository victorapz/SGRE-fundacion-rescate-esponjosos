"use strict";

import assert from "node:assert/strict";
import test from "node:test";

process.env.ACCESS_TOKEN_SECRET ||= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ||= "test-refresh-secret";
process.env.CORS_ALLOWED_ORIGINS ||= "http://localhost:5173";
process.env.CORS_ALLOW_CREDENTIALS ||= "true";

const { default: authRoutes } = await import(
  new URL("./auth.routes.js?auth-routes-test", import.meta.url),
);

function findRouteIndex(path, method) {
  return authRoutes.stack.findIndex(
    (layer) => layer.route?.path === path && layer.route?.methods?.[method],
  );
}

test("auth routes deja refresh y logout fuera del middleware JWT", () => {
  const loginIndex = findRouteIndex("/login", "post");
  const refreshIndex = findRouteIndex("/refresh", "post");
  const logoutIndex = findRouteIndex("/logout", "post");
  const meIndex = findRouteIndex("/me", "get");
  const myProfileGetIndex = findRouteIndex("/me/profile", "get");
  const myProfilePatchIndex = findRouteIndex("/me/profile", "patch");
  const myPasswordPatchIndex = findRouteIndex("/me/password", "patch");
  const authenticateIndex = authRoutes.stack.findIndex((layer) => !layer.route);

  assert.ok(loginIndex >= 0);
  assert.ok(refreshIndex >= 0);
  assert.ok(logoutIndex >= 0);
  assert.ok(meIndex >= 0);
  assert.ok(myProfileGetIndex >= 0);
  assert.ok(myProfilePatchIndex >= 0);
  assert.ok(myPasswordPatchIndex >= 0);
  assert.ok(authenticateIndex >= 0);

  assert.ok(loginIndex < authenticateIndex);
  assert.ok(refreshIndex < authenticateIndex);
  assert.ok(logoutIndex < authenticateIndex);
  assert.ok(meIndex > authenticateIndex);
  assert.ok(myProfileGetIndex > authenticateIndex);
  assert.ok(myProfilePatchIndex > authenticateIndex);
  assert.ok(myPasswordPatchIndex > authenticateIndex);
});

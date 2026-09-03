import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __resetAuthSessionForTests,
  clearAccessToken,
  getAccessToken,
  invalidateSession,
  setAccessToken,
  subscribeToSessionInvalidation,
} from "./auth-session.service.js";

function createStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  __resetAuthSessionForTests();
  globalThis.localStorage = originalLocalStorage;
});

test("auth session persiste y limpia el access token", () => {
  globalThis.localStorage = createStorageMock();

  assert.equal(getAccessToken(), null);
  assert.equal(setAccessToken("token-1"), "token-1");
  assert.equal(getAccessToken(), "token-1");

  clearAccessToken();
  assert.equal(getAccessToken(), null);
});

test("auth session invalida la sesion una sola vez mientras el handler sigue en progreso", async () => {
  globalThis.localStorage = createStorageMock();
  setAccessToken("token-1");

  let calls = 0;
  subscribeToSessionInvalidation(async () => {
    calls += 1;
    await Promise.resolve();
  });

  await Promise.all([
    invalidateSession("expired"),
    invalidateSession("expired"),
    invalidateSession("expired"),
  ]);

  assert.equal(calls, 1);
  assert.equal(getAccessToken(), null);
});

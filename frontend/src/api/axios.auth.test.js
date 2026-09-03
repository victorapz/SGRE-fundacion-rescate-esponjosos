import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import api, {
  __resetAuthHttpTestState,
  __setAuthHttpTestHooks,
} from "./axios.js";
import {
  __resetAuthSessionForTests,
  setAccessToken,
  subscribeToSessionInvalidation,
} from "../services/auth-session.service.js";

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

const originalAdapter = api.defaults.adapter;
const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  globalThis.localStorage = originalLocalStorage;
  __resetAuthHttpTestState();
  __resetAuthSessionForTests();
});

test("request interceptor agrega Authorization y respeta skipAuth", async () => {
  globalThis.localStorage = createStorageMock();
  setAccessToken("access-123");

  const requestHandler = api.interceptors.request.handlers[0].fulfilled;
  const configWithAuth = await requestHandler({
    url: "/animals",
    baseURL: "http://localhost:3000/api",
    headers: {},
  });
  const configWithoutAuth = await requestHandler({
    url: "/public/notices",
    baseURL: "http://localhost:3000/api",
    headers: {},
    skipAuth: true,
  });

  assert.equal(configWithAuth.headers.Authorization, "Bearer access-123");
  assert.equal("Authorization" in configWithoutAuth.headers, false);
});

test("response interceptor no intenta refresh para 403 ni para requests ya reintentadas", async () => {
  const responseRejected = api.interceptors.response.handlers[0].rejected;
  let refreshCalls = 0;

  __setAuthHttpTestHooks({
    async refreshAccessToken() {
      refreshCalls += 1;
      return "new-token";
    },
  });

  await assert.rejects(() => responseRejected({
    config: {
      url: "/accounting/reports",
      baseURL: "http://localhost:3000/api",
      headers: {},
    },
    response: { status: 403 },
  }));

  await assert.rejects(() => responseRejected({
    config: {
      url: "/animals",
      baseURL: "http://localhost:3000/api",
      headers: {},
      _retry: true,
    },
    response: { status: 401 },
  }));

  assert.equal(refreshCalls, 0);
});

test("response interceptor no intenta refresh para la propia ruta de refresh ni para errores de red", async () => {
  const responseRejected = api.interceptors.response.handlers[0].rejected;
  let refreshCalls = 0;

  __setAuthHttpTestHooks({
    async refreshAccessToken() {
      refreshCalls += 1;
      return "new-token";
    },
  });

  await assert.rejects(() => responseRejected({
    config: {
      url: "/auth/refresh",
      baseURL: "http://localhost:3000/api",
      headers: {},
    },
    response: { status: 401 },
  }));

  await assert.rejects(() => responseRejected({
    config: {
      url: "/auth/me",
      baseURL: "http://localhost:3000/api",
      headers: {},
    },
    code: "ERR_NETWORK",
    message: "Network Error",
  }));

  assert.equal(refreshCalls, 0);
});

test("response interceptor comparte un solo refresh para multiples 401 y reintenta una vez", async () => {
  globalThis.localStorage = createStorageMock();
  setAccessToken("expired-token");

  let refreshCalls = 0;
  api.defaults.adapter = async (config) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data: {
      authorization: config.headers?.Authorization || null,
      retried: Boolean(config._retry),
    },
  });

  __setAuthHttpTestHooks({
    async refreshAccessToken() {
      refreshCalls += 1;
      return "fresh-token";
    },
  });

  const responseRejected = api.interceptors.response.handlers[0].rejected;
  const createError = () => ({
    config: {
      url: "/animals",
      baseURL: "http://localhost:3000/api",
      headers: {},
    },
    response: { status: 401 },
  });

  const results = await Promise.all([
    responseRejected(createError()),
    responseRejected(createError()),
    responseRejected(createError()),
  ]);

  assert.equal(refreshCalls, 1);
  assert.equal(results[0].data.authorization, "Bearer fresh-token");
  assert.equal(results[1].data.authorization, "Bearer fresh-token");
  assert.equal(results[2].data.authorization, "Bearer fresh-token");
  assert.equal(results[0].data.retried, true);
});

test("response interceptor invalida la sesion una sola vez si el refresh falla", async () => {
  globalThis.localStorage = createStorageMock();
  setAccessToken("expired-token");

  let invalidationCalls = 0;
  subscribeToSessionInvalidation(async () => {
    invalidationCalls += 1;
  });

  __setAuthHttpTestHooks({
    async refreshAccessToken() {
      throw new Error("refresh failed");
    },
  });

  const responseRejected = api.interceptors.response.handlers[0].rejected;
  const createError = () => ({
    config: {
      url: "/animals",
      baseURL: "http://localhost:3000/api",
      headers: {},
    },
    response: { status: 401 },
  });

  await Promise.allSettled([
    responseRejected(createError()),
    responseRejected(createError()),
    responseRejected(createError()),
  ]);

  assert.equal(invalidationCalls, 1);
});

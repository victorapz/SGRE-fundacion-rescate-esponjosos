const ACCESS_TOKEN_STORAGE_KEY = "token";

let accessTokenMemory = null;
let sessionInvalidationHandler = null;
let sessionInvalidationPromise = null;

function getStorage() {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) {
    return null;
  }

  return globalThis.localStorage;
}

export function getAccessToken() {
  if (typeof accessTokenMemory === "string" && accessTokenMemory.trim()) {
    return accessTokenMemory;
  }

  const storage = getStorage();
  const storedToken = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";

  if (!storedToken.trim()) {
    accessTokenMemory = null;
    return null;
  }

  accessTokenMemory = storedToken;
  return storedToken;
}

export function setAccessToken(token) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  const storage = getStorage();

  if (!normalizedToken) {
    accessTokenMemory = null;
    storage?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    return null;
  }

  accessTokenMemory = normalizedToken;
  storage?.setItem(ACCESS_TOKEN_STORAGE_KEY, normalizedToken);
  return normalizedToken;
}

export function clearAccessToken() {
  accessTokenMemory = null;
  getStorage()?.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function subscribeToSessionInvalidation(handler) {
  sessionInvalidationHandler = typeof handler === "function" ? handler : null;

  return () => {
    if (sessionInvalidationHandler === handler) {
      sessionInvalidationHandler = null;
    }
  };
}

export async function invalidateSession(reason = "expired") {
  clearAccessToken();

  if (!sessionInvalidationHandler) {
    return;
  }

  if (!sessionInvalidationPromise) {
    sessionInvalidationPromise = Promise.resolve(sessionInvalidationHandler(reason))
      .finally(() => {
        sessionInvalidationPromise = null;
      });
  }

  return sessionInvalidationPromise;
}

export function __resetAuthSessionForTests() {
  accessTokenMemory = null;
  sessionInvalidationHandler = null;
  sessionInvalidationPromise = null;
}

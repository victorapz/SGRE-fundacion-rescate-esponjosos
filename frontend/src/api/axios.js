import axios from "axios";
import { getConfiguredApiBaseUrl } from "../utils/publicDonation.js";
import {
  getAccessToken,
  invalidateSession,
  setAccessToken,
} from "../services/auth-session.service.js";

const api = axios.create({
  withCredentials: true,
});

let refreshPromise = null;
let sessionFailurePromise = null;

const authHttpHooks = {
  async refreshAccessToken() {
    const payload = await requestAccessTokenRefreshDirect();
    const refreshedToken = payload?.accessToken || payload?.token || "";

    if (!refreshedToken) {
      throw new Error("No se recibio un access token valido durante el refresh.");
    }

    setAccessToken(refreshedToken);
    return refreshedToken;
  },
  async onRefreshFailure() {
    await invalidateSession("refresh_failed");
  },
};

async function requestAccessTokenRefreshDirect() {
  const baseURL = getConfiguredApiBaseUrl();
  const headers = {};

  if (baseURL?.includes("ngrok-free")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  const response = await axios.post(
    "/auth/refresh",
    null,
    {
      baseURL,
      headers,
      withCredentials: true,
      skipAuth: true,
      skipAuthRefresh: true,
    },
  );

  return response.data?.data || {};
}

function isAuthLifecycleRequest(config) {
  const requestUrl = String(config?.url || "");
  return ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) =>
    requestUrl.includes(path),
  );
}

function shouldAttemptRefresh(error) {
  const originalRequest = error?.config;

  if (!originalRequest || !error?.response) {
    return false;
  }

  if (error.response.status !== 401) {
    return false;
  }

  if (originalRequest.skipAuth || originalRequest.skipAuthRefresh) {
    return false;
  }

  if (originalRequest._retry) {
    return false;
  }

  if (isAuthLifecycleRequest(originalRequest)) {
    return false;
  }

  return true;
}

api.interceptors.request.use((config) => {
  config.baseURL = config.baseURL || getConfiguredApiBaseUrl();

  if (config.baseURL?.includes("ngrok-free")) {
    config.headers = config.headers || {};
    config.headers["ngrok-skip-browser-warning"] = "true";
  }

  if (config.skipAuth) {
    return config;
  }

  if (config.headers?.Authorization) {
    return config;
  }

  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!shouldAttemptRefresh(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = authHttpHooks.refreshAccessToken()
          .finally(() => {
            refreshPromise = null;
          });
      }

      const refreshedToken = await refreshPromise;
      setAccessToken(refreshedToken);
      originalRequest.headers = {
        ...(originalRequest.headers || {}),
        Authorization: `Bearer ${refreshedToken}`,
      };

      return api(originalRequest);
    } catch (refreshError) {
      if (!sessionFailurePromise) {
        sessionFailurePromise = Promise.resolve(authHttpHooks.onRefreshFailure())
          .finally(() => {
            sessionFailurePromise = null;
          });
      }

      await sessionFailurePromise;
      return Promise.reject(refreshError);
    }
  },
);

export function __setAuthHttpTestHooks(overrides = {}) {
  if (typeof overrides.refreshAccessToken === "function") {
    authHttpHooks.refreshAccessToken = overrides.refreshAccessToken;
  }

  if (typeof overrides.onRefreshFailure === "function") {
    authHttpHooks.onRefreshFailure = overrides.onRefreshFailure;
  }
}

export function __resetAuthHttpTestState() {
  refreshPromise = null;
  sessionFailurePromise = null;
  authHttpHooks.refreshAccessToken = async () => {
    const payload = await requestAccessTokenRefreshDirect();
    const refreshedToken = payload?.accessToken || payload?.token || "";

    if (!refreshedToken) {
      throw new Error("No se recibio un access token valido durante el refresh.");
    }

    setAccessToken(refreshedToken);
    return refreshedToken;
  };
  authHttpHooks.onRefreshFailure = async () => {
    await invalidateSession("refresh_failed");
  };
}

export default api;

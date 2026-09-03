import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { getMe, requestAccessTokenRefresh } from "../services/auth.service";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
  subscribeToSessionInvalidation,
} from "../services/auth-session.service";
import { areSameAuthUser, normalizeAuthProfile } from "./auth.profile";

export const AuthContext = createContext();

function buildUserFromToken(token) {
  if (!token) return null;

  try {
    const decoded = jwtDecode(token);
    const roles = Array.isArray(decoded.roles)
      ? decoded.roles
      : decoded.role
        ? [decoded.role]
        : [];

    return {
      id: Number(decoded.sub),
      rol: decoded.role,
      roles,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [isRefreshingUser, setIsRefreshingUser] = useState(false);
  const refreshUserPromiseRef = useRef(null);

  const setNormalizedUser = useCallback((profile = {}, fallbackUser = null) => {
    setUser((current) => {
      const normalizedUser = normalizeAuthProfile(profile, fallbackUser || current);
      return areSameAuthUser(current, normalizedUser) ? current : normalizedUser;
    });
  }, []);

  const clearSessionState = useCallback(() => {
    refreshUserPromiseRef.current = null;
    clearAccessToken();
    setUser(null);
    setIsRefreshingUser(false);
    setIsAuthResolved(true);
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (refreshUserPromiseRef.current) {
      return refreshUserPromiseRef.current;
    }

    const pendingRefresh = (async () => {
      setIsRefreshingUser(true);

      try {
        const profile = await getMe();
        setNormalizedUser(profile);
        return profile;
      } finally {
        setIsRefreshingUser(false);
        refreshUserPromiseRef.current = null;
      }
    })();

    refreshUserPromiseRef.current = pendingRefresh;
    return pendingRefresh;
  }, [setNormalizedUser]);

  const updateCurrentUserProfile = useCallback((profile) => {
    setNormalizedUser(profile);
    return profile;
  }, [setNormalizedUser]);

  const loginUser = useCallback((data) => {
    const token = data.token ?? data.accessToken;

    if (!token) {
      throw new Error("No se recibio un access token válido");
    }

    const userData = buildUserFromToken(token);

    if (!userData) {
      throw new Error("Token inválido");
    }

    setAccessToken(token);
    setNormalizedUser({}, userData);
    setIsAuthResolved(true);
    void refreshUserProfile().catch(() => {});
  }, [refreshUserProfile, setNormalizedUser]);

  const logoutUser = useCallback(() => {
    clearSessionState();
  }, [clearSessionState]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeToSessionInvalidation(() => {
      if (cancelled) return;
      clearSessionState();
    });

    const hydrateSession = async () => {
      const storedToken = getAccessToken();
      const tokenUser = buildUserFromToken(storedToken);

      if (tokenUser && !cancelled) {
        setNormalizedUser({}, tokenUser);
      }

      try {
        if (!storedToken) {
          const refreshPayload = await requestAccessTokenRefresh();
          const refreshedToken = refreshPayload?.accessToken || refreshPayload?.token;

          if (!refreshedToken) {
            throw new Error("No se recibio un access token válido");
          }

          setAccessToken(refreshedToken);
        }

        const activeToken = getAccessToken();
        const activeUser = buildUserFromToken(activeToken);

        if (!activeUser) {
          throw new Error("Token inválido");
        }

        if (!cancelled) {
          setNormalizedUser({}, activeUser);
        }

        if (!cancelled) {
          await refreshUserProfile();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error?.response?.status === 401 || !tokenUser) {
          clearSessionState();
          return;
        }
      } finally {
        if (!cancelled) {
          setIsAuthResolved(true);
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [clearSessionState, refreshUserProfile, setNormalizedUser]);

  const value = useMemo(() => ({
    user,
    isAuthResolved,
    isRefreshingUser,
    loginUser,
    logoutUser,
    refreshUserProfile,
    updateCurrentUserProfile,
  }), [
    user,
    isAuthResolved,
    isRefreshingUser,
    loginUser,
    logoutUser,
    refreshUserProfile,
    updateCurrentUserProfile,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

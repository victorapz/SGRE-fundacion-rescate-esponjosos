import api from "../api/axios";

function buildAuthError(error, fallback) {
  if (!error?.response) {
    return new Error("No fue posible conectar con el servidor.");
  }

  const status = Number(error.response.status || 0);
  const details = error?.response?.data?.details;
  const backendMessage = typeof details === "string"
    ? details
    : error?.response?.data?.message;

  if (status === 401) {
    return new Error("Tu sesion expiro. Inicia sesion nuevamente.");
  }

  return new Error(backendMessage || error?.message || fallback);
}

export const login = async (data) => {
  try {
    const response = await api.post("/auth/login", data, {
      skipAuth: true,
      skipAuthRefresh: true,
    });
    return response.data.data;
  } catch (error) {
    throw buildAuthError(error, "No fue posible iniciar sesion.");
  }
};

export const logout = async () => {
  try {
    return await api.post("/auth/logout", null, {
      skipAuth: true,
      skipAuthRefresh: true,
    });
  } catch (error) {
    throw buildAuthError(error, "No fue posible cerrar sesion.");
  }
};

export const requestAccessTokenRefresh = async () => {
  const response = await api.post("/auth/refresh", null, {
    skipAuth: true,
    skipAuthRefresh: true,
  });
  return response.data.data;
};

export const getMe = async () => {
  try {
    const response = await api.get("/auth/me");
    return response.data.data;
  } catch (error) {
    throw buildAuthError(error, "No fue posible recuperar tu sesion.");
  }
};

export const getMyProfile = async () => {
  try {
    const response = await api.get("/auth/me/profile");
    return response.data.data;
  } catch (error) {
    throw buildAuthError(error, "No se pudo cargar tu perfil.");
  }
};

export const updateMyProfile = async (payload) => {
  try {
    const response = await api.patch("/auth/me/profile", payload);
    return response.data.data;
  } catch (error) {
    throw buildAuthError(error, "No se pudo actualizar tu perfil.");
  }
};

export const changeMyPassword = async (payload) => {
  try {
    const response = await api.patch("/auth/me/password", payload);
    return response.data.data;
  } catch (error) {
    throw buildAuthError(error, "No se pudo actualizar tu contrasena.");
  }
};

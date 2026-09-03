"use strict";

import {
  changeMyPasswordService,
  getMeService,
  getMyProfileService,
  loginService,
  logoutService,
  refreshTokenService,
  updateMyProfileService,
} from "../services/auth.service.js";
import {
  authValidation,
  myPasswordChangeValidation,
  myProfileUpdateValidation,
} from "../validations/auth.validation.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";
import {
  clearRefreshTokenCookie,
  readRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from "../utils/authCookies.js";

export async function login(req, res) {
  try {
    const { body } = req;
    const { error } = authValidation.validate(body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [accessToken, refreshToken, errorToken] = await loginService(body);

    if (errorToken) {
      return handleErrorClient(res, 400, "Error iniciando sesion", errorToken);
    }

    setRefreshTokenCookie(res, refreshToken);

    return handleSuccess(res, 200, "Inicio de sesion exitoso", {
      token: accessToken,
      accessToken,
    });
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function logout(req, res) {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    const [result, errorToken] = await logoutService(refreshToken);
    clearRefreshTokenCookie(res);

    if (errorToken) {
      return handleErrorClient(res, 400, "Error cerrando sesion", errorToken);
    }

    return handleSuccess(res, 200, "Logout exitoso", result);
  } catch (error) {
    clearRefreshTokenCookie(res);
    return handleErrorServer(res, 500, error.message);
  }
}

export async function refresh(req, res) {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    const [tokens, errorToken] = await refreshTokenService(refreshToken);

    if (errorToken) {
      clearRefreshTokenCookie(res);
      return handleErrorClient(
        res,
        401,
        "Tu sesion ha expirado. Inicia sesion nuevamente.",
        errorToken,
      );
    }

    setRefreshTokenCookie(res, tokens.refreshToken);

    return handleSuccess(res, 200, "Token refrescado exitosamente", {
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getMe(req, res) {
  try {
    const userId = req.user?.id_usuario;
    const [me, errorMe] = await getMeService(userId);

    if (errorMe) {
      return handleErrorClient(res, 404, errorMe);
    }

    return handleSuccess(res, 200, "Sesion encontrada", me);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getMyProfile(req, res) {
  try {
    const userId = req.user?.id_usuario;
    const [profile, profileError] = await getMyProfileService(userId);

    if (profileError) {
      return handleErrorClient(
        res,
        profileError.statusCode || 400,
        profileError.message || "No fue posible obtener tu perfil.",
      );
    }

    return handleSuccess(res, 200, "Perfil encontrado", profile);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateMyProfile(req, res) {
  try {
    const { error } = myProfileUpdateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const userId = req.user?.id_usuario;
    const [profile, profileError] = await updateMyProfileService(userId, req.body);

    if (profileError) {
      return handleErrorClient(
        res,
        profileError.statusCode || 400,
        profileError.message || "No fue posible actualizar tu perfil.",
      );
    }

    return handleSuccess(res, 200, "Perfil actualizado correctamente", profile);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function changeMyPassword(req, res) {
  try {
    const { error } = myPasswordChangeValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const userId = req.user?.id_usuario;
    const refreshToken = readRefreshTokenFromRequest(req);
    const [result, passwordError] = await changeMyPasswordService(
      userId,
      req.body,
      refreshToken,
    );

    if (passwordError) {
      return handleErrorClient(
        res,
        passwordError.statusCode || 400,
        passwordError.message || "No fue posible cambiar tu contrasena.",
      );
    }

    return handleSuccess(res, 200, "La contrasena fue actualizada correctamente.", result);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

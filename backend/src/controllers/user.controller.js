"use strict";

import {
  userCreateValidation,
  userPasswordResetBodyValidation,
  userQueryValidation,
  userUpdateBodyValidation,
} from "../validations/user.validation.js";

import {
  createUserService,
  deleteUserService,
  getUsersService,
  getUserService,
  resetUserPasswordService,
  updateUserService,
} from "../services/user.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

function handleServiceError(res, serviceError, fallbackStatus = 400, fallbackMessage = "") {
  if (serviceError && typeof serviceError === "object") {
    return handleErrorClient(
      res,
      serviceError.statusCode || fallbackStatus,
      serviceError.message || fallbackMessage,
      serviceError.details || {},
    );
  }

  return handleErrorClient(res, fallbackStatus, serviceError || fallbackMessage);
}

export async function createUser(req, res) {
  try {
    const { body } = req;
    const { error } = userCreateValidation.validate(body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validaciÃ³n", error.message);
    }

    const [user, errorUser] = await createUserService(body);

    if (errorUser) {
      return handleServiceError(res, errorUser, 400, "No fue posible crear el usuario.");
    }

    return handleSuccess(res, 201, "Usuario creado correctamente", user);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getUser(req, res) {
  try {
    const { rut, id, email } = req.query;
    const { error } = userQueryValidation.validate({ rut, id, email });

    if (error) {
      return handleErrorClient(res, 400, "Error de validaciÃ³n", error.message);
    }

    const [user, errorUser] = await getUserService({ rut, id, email });

    if (errorUser) {
      return handleErrorClient(res, 404, errorUser);
    }

    return handleSuccess(res, 200, "Usuario encontrado", user);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getUsers(req, res) {
  try {
    const [users, errorUsers] = await getUsersService();

    if (errorUsers) {
      return handleErrorClient(res, 404, errorUsers);
    }

    return users.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Usuarios encontrados", users);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateUser(req, res) {
  try {
    const { rut, id, email } = req.query;
    const { body } = req;
    const { error: queryError } = userQueryValidation.validate({
      rut,
      id,
      email,
    });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validaciÃ³n en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = userUpdateBodyValidation.validate(body);

    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validaciÃ³n en los datos enviados",
        bodyError.message,
      );
    }

    const [user, userError] = await updateUserService({ rut, id, email }, body);

    if (userError) {
      return handleServiceError(
        res,
        userError,
        400,
        "No fue posible actualizar el usuario.",
      );
    }

    return handleSuccess(res, 200, "Usuario modificado correctamente", user);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteUser(req, res) {
  try {
    const { rut, id, email } = req.query;

    const { error: queryError } = userQueryValidation.validate({
      rut,
      id,
      email,
    });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validaciÃ³n en la consulta",
        queryError.message,
      );
    }

    const [userDelete, errorUserDelete] = await deleteUserService({
      rut,
      id,
      email,
    });

    if (errorUserDelete) {
      return handleErrorClient(
        res,
        404,
        "Error eliminado al usuario",
        errorUserDelete,
      );
    }

    return handleSuccess(res, 200, "Usuario eliminado correctamente", userDelete);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function resetUserPassword(req, res) {
  try {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return handleErrorClient(res, 400, "Error de validacion", "El usuario seleccionado no existe.");
    }

    const { error } = userPasswordResetBodyValidation.validate(req.body);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const actorUserId = req.user?.id_usuario;
    const [result, resetError] = await resetUserPasswordService(
      targetUserId,
      actorUserId,
      req.body,
    );

    if (resetError) {
      return handleServiceError(
        res,
        resetError,
        400,
        "No fue posible restablecer la contrasena del usuario.",
      );
    }

    return handleSuccess(res, 200, "La contrasena fue restablecida correctamente.", result);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

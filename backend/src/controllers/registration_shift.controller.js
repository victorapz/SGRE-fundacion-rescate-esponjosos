"use strict";

import {
  registrationShiftByShiftValidation,
  registrationShiftByUserValidation,
  registrationShiftBitacoraValidation,
  registrationShiftIdValidation,
  registrationShiftParamsValidation,
  registrationShiftAttendanceValidation,
  registrationShiftStatusValidation,
} from "../validations/registration_shift.validation.js";

import {
  cancelRegistrationService,
  getShiftRegistrationsService,
  getUserHistoryRegistrationsService,
  getUserRegistrationsService,
  getUserUpcomingRegistrationsService,
  markAttendanceService,
  registerUserInShiftService,
  saveRegistrationBitacoraService,
  updateRegistrationStatusService,
} from "../services/registration_shift.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";
import { AppDataSource } from "../config/configDb.js";
import User from "../entities/user.entity.js";

async function userHasPermission(userId, permissionName) {
  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({
    where: { id_usuario: Number(userId) },
    relations: {
      UserRole: {
        role: {
          RolePermission: {
            permission: true,
          },
        },
      },
    },
  });

  if (!user || !user.UserRole || user.UserRole.length === 0) return false;

  return user.UserRole.some((userRole) =>
    userRole.role.RolePermission.some(
      (rolePermission) => rolePermission.permission.nombre === permissionName,
    ),
  );
}

async function canActOnUser(reqUserId, targetUserId, permissionName) {
  if (Number(reqUserId) === Number(targetUserId)) return true;
  return userHasPermission(reqUserId, permissionName);
}

export async function registerUserInShift(req, res) {
  try {
    const { shiftId, userId } = req.params;

    const { error } = registrationShiftParamsValidation.validate({ shiftId, userId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const canRegister = await canActOnUser(
      req.user?.id_usuario,
      userId,
      "home:shift:register",
    );

    if (!canRegister) {
      return handleErrorClient(
        res,
        403,
        "Acceso denegado",
        "No puedes registrar a otro usuario",
      );
    }

    const [registration, registrationError] = await registerUserInShiftService(
      shiftId,
      userId,
    );

    if (registrationError)
      return handleErrorClient(res, 400, "Error al registrar", registrationError);

    handleSuccess(res, 201, "Registro creado correctamente", registration);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function cancelRegistration(req, res) {
  try {
    const { shiftId, userId } = req.params;

    const { error } = registrationShiftParamsValidation.validate({ shiftId, userId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const canCancel = await canActOnUser(
      req.user?.id_usuario,
      userId,
      "home:shift:cancel",
    );

    if (!canCancel) {
      return handleErrorClient(
        res,
        403,
        "Acceso denegado",
        "No puedes cancelar el registro de otro usuario",
      );
    }

    const [registration, registrationError] = await cancelRegistrationService(
      shiftId,
      userId,
    );

    if (registrationError)
      return handleErrorClient(res, 404, "Error al cancelar", registrationError);

    handleSuccess(res, 200, "Registro cancelado correctamente", registration);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getShiftRegistrations(req, res) {
  try {
    const { shiftId } = req.params;

    const { error } = registrationShiftByShiftValidation.validate({ shiftId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [registrations, registrationsError] = await getShiftRegistrationsService(
      shiftId,
    );

    if (registrationsError)
      return handleErrorClient(res, 400, registrationsError);

    handleSuccess(res, 200, "Inscritos encontrados", registrations ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getUserRegistrations(req, res) {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    const { error } = registrationShiftByUserValidation.validate({ userId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const canView = await canActOnUser(
      req.user?.id_usuario,
      userId,
      "home:shift:registrations:read",
    );

    if (!canView) {
      return handleErrorClient(
        res,
        403,
        "Acceso denegado",
        "No puedes ver las inscripciones de otro usuario",
      );
    }

    const [registrations, registrationsError] = await getUserRegistrationsService(
      userId,
      year,
      month,
    );

    if (registrationsError)
      return handleErrorClient(res, 400, registrationsError);

    handleSuccess(res, 200, "Turnos encontrados", registrations ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getUserUpcomingRegistrations(req, res) {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    const { error } = registrationShiftByUserValidation.validate({ userId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const canView = await canActOnUser(
      req.user?.id_usuario,
      userId,
      "home:shift:registrations:read",
    );

    if (!canView) {
      return handleErrorClient(
        res,
        403,
        "Acceso denegado",
        "No puedes ver las inscripciones de otro usuario",
      );
    }

    const [registrations, registrationsError] = await getUserUpcomingRegistrationsService(
      userId,
      year,
      month,
    );

    if (registrationsError)
      return handleErrorClient(res, 400, registrationsError);

    handleSuccess(res, 200, "Turnos futuros encontrados", registrations ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getUserHistoryRegistrations(req, res) {
  try {
    const { userId } = req.params;
    const { year, month } = req.query;

    const { error } = registrationShiftByUserValidation.validate({ userId });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const canView = await canActOnUser(
      req.user?.id_usuario,
      userId,
      "home:shift:registrations:read",
    );

    if (!canView) {
      return handleErrorClient(
        res,
        403,
        "Acceso denegado",
        "No puedes ver las inscripciones de otro usuario",
      );
    }

    const [registrations, registrationsError] = await getUserHistoryRegistrationsService(
      userId,
      year,
      month,
    );

    if (registrationsError)
      return handleErrorClient(res, 400, registrationsError);

    handleSuccess(res, 200, "Historial encontrado", registrations ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateRegistrationStatus(req, res) {
  try {
    const { registrationId } = req.params;
    const { estado } = req.body;

    const { error: paramsError } = registrationShiftIdValidation.validate({
      registrationId,
    });

    if (paramsError) {
      return handleErrorClient(res, 400, "Error de validacion", paramsError.message);
    }

    const { error: bodyError } = registrationShiftStatusValidation.validate({ estado });

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion", bodyError.message);
    }

    const [updatedRegistration, updateError] = await updateRegistrationStatusService(
      registrationId,
      estado,
    );

    if (updateError) {
      return handleErrorClient(res, 404, "Error al actualizar", updateError);
    }

    return handleSuccess(
      res,
      200,
      "Registro actualizado correctamente",
      updatedRegistration,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function saveRegistrationBitacora(req, res) {
  try {
    const { registrationId } = req.params;
    const { bitacora } = req.body;

    const { error: paramsError } = registrationShiftIdValidation.validate({
      registrationId,
    });

    if (paramsError) {
      return handleErrorClient(res, 400, "Error de validacion", paramsError.message);
    }

    const { error: bodyError } = registrationShiftBitacoraValidation.validate({ bitacora });

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion", bodyError.message);
    }

    const [updatedRegistration, updateError] = await saveRegistrationBitacoraService(
      registrationId,
      req.user?.id_usuario,
      bitacora,
    );

    if (updateError) {
      return handleErrorClient(res, 400, "Error al actualizar", updateError);
    }

    return handleSuccess(
      res,
      200,
      "Bitacora guardada correctamente",
      updatedRegistration,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function markAttendance(req, res) {
  try {
    const { registrationId } = req.params;
    const { estado } = req.body;

    const { error: paramsError } = registrationShiftIdValidation.validate({
      registrationId,
    });

    if (paramsError) {
      return handleErrorClient(res, 400, "Error de validacion", paramsError.message);
    }

    const { error: bodyError } = registrationShiftAttendanceValidation.validate({ estado });

    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion", bodyError.message);
    }

    const [updatedRegistration, updateError] = await markAttendanceService(
      registrationId,
      req.user?.id_usuario,
      estado,
    );

    if (updateError) {
      return handleErrorClient(res, 400, "Error al actualizar", updateError);
    }

    return handleSuccess(
      res,
      200,
      "Asistencia registrada correctamente",
      updatedRegistration,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

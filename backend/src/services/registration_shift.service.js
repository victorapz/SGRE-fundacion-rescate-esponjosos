"use strict";

import { Not } from "typeorm";
import RegistrationShift from "../entities/registration_shift.js";
import Shift from "../entities/shift.entity.js";
import User from "../entities/user.entity.js";
import { AppDataSource } from "../config/configDb.js";
import { isShiftCurrent, isShiftFuture, isShiftPast } from "../helpers/shiftTime.helper.js";

function buildMonthRange(year, month) {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth)) return null;
  if (numericMonth < 1 || numericMonth > 12) return null;

  const start = new Date(numericYear, numericMonth - 1, 1);
  const end = new Date(numericYear, numericMonth, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function getActiveRegistrationCount(registrationRepository, shiftId) {
  return registrationRepository.count({
    where: {
      shift: { id_turno: Number(shiftId) },
      estado: Not("CANCELADO"),
    },
  });
}

async function isShiftAvailable(shift, registrationRepository) {
  if (!shift.estado) return false;
  if (!isShiftFuture(shift)) return false;

  const activeRegistrations = await getActiveRegistrationCount(
    registrationRepository,
    shift.id_turno,
  );

  return activeRegistrations < shift.cantidad_maxima;
}

async function getUserRegistrationsQuery(userId, year, month) {
  const registrationRepository = AppDataSource.getRepository(RegistrationShift);
  const query = registrationRepository
    .createQueryBuilder("registration")
    .leftJoinAndSelect("registration.user", "user")
    .leftJoinAndSelect("registration.shift", "shift")
    .where("user.id_usuario = :userId", { userId: Number(userId) })
    .andWhere("registration.estado <> :estado", { estado: "CANCELADO" });

  const range = buildMonthRange(year, month);
  if (range) {
    query.andWhere("shift.fecha BETWEEN :start AND :end", {
      start: range.start,
      end: range.end,
    });
  }

  return query.getMany();
}

function parseShiftDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-");
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const [day, month, year] = value.split("-");
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isSameOrAfter(dateValue, reference) {
  return dateValue.getTime() >= reference.getTime();
}

export async function registerUserInShiftService(shiftId, userId) {
  try {
    const shiftRepository = AppDataSource.getRepository(Shift);
    const userRepository = AppDataSource.getRepository(User);
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const shift = await shiftRepository.findOne({
      where: { id_turno: Number(shiftId) },
    });

    if (!shift) return [null, "Turno no encontrado"];

    const isAvailable = await isShiftAvailable(shift, registrationRepository);
    if (!isAvailable) return [null, "El turno no esta disponible"];

    const user = await userRepository.findOne({
      where: { id_usuario: Number(userId) },
    });

    if (!user) return [null, "Usuario no encontrado"];

    const existingRegistration = await registrationRepository.findOne({
      where: {
        shift: { id_turno: Number(shiftId) },
        user: { id_usuario: Number(userId) },
      },
    });

    if (existingRegistration) {
      if (existingRegistration.estado === "CANCELADO") {
        existingRegistration.estado = "INSCRITO";
        const restored = await registrationRepository.save(existingRegistration);
        return [restored, null];
      }

      return [null, "El usuario ya esta registrado en este turno"];
    }

    const newRegistration = registrationRepository.create({
      shift: { id_turno: Number(shiftId) },
      user: { id_usuario: Number(userId) },
      estado: "INSCRITO",
    });

    const savedRegistration = await registrationRepository.save(newRegistration);

    return [savedRegistration, null];
  } catch (error) {
    console.error("Error al registrar usuario en turno:", error);
    return [null, "Error interno al registrar usuario en turno"];
  }
}

export async function cancelRegistrationService(shiftId, userId) {
  try {
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const registrationFound = await registrationRepository.findOne({
      where: {
        shift: { id_turno: Number(shiftId) },
        user: { id_usuario: Number(userId) },
      },
      relations: {
        shift: true,
      },
    });

    if (!registrationFound) return [null, "Registro no encontrado"];

    if (registrationFound.estado === "CANCELADO") {
      return [registrationFound, null];
    }

    if (!isShiftFuture(registrationFound.shift)) {
      return [null, "Solo puedes cancelar turnos futuros"];
    }

    registrationFound.estado = "CANCELADO";

    const updatedRegistration = await registrationRepository.save(registrationFound);

    return [updatedRegistration, null];
  } catch (error) {
    console.error("Error al cancelar registro:", error);
    return [null, "Error interno al cancelar registro"];
  }
}

export async function getShiftRegistrationsService(shiftId) {
  try {
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const registrations = await registrationRepository.find({
      where: {
        shift: { id_turno: Number(shiftId) },
      },
      relations: {
        user: true,
        shift: true,
      },
    });

    return [registrations, null];
  } catch (error) {
    console.error("Error al obtener inscritos del turno:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateRegistrationStatusService(registrationId, estado) {
  try {
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const registrationFound = await registrationRepository.findOne({
      where: { turno_registro_id: Number(registrationId) },
      relations: {
        user: true,
        shift: true,
      },
    });

    if (!registrationFound) return [null, "Registro no encontrado"];

    registrationFound.estado = estado;
    const updatedRegistration = await registrationRepository.save(registrationFound);

    return [updatedRegistration, null];
  } catch (error) {
    console.error("Error al actualizar estado de registro:", error);
    return [null, "Error interno al actualizar el registro"];
  }
}

export async function getUserRegistrationsService(userId, year, month) {
  try {
    const registrations = await getUserRegistrationsQuery(userId, year, month);

    return [registrations, null];
  } catch (error) {
    console.error("Error al obtener turnos del usuario:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getUserUpcomingRegistrationsService(userId, year, month) {
  try {
    const registrations = await getUserRegistrationsQuery(userId, year, month);
    const upcoming = registrations.filter((registration) =>
      isShiftCurrent(registration.shift) || isShiftFuture(registration.shift),
    );

    return [upcoming, null];
  } catch (error) {
    console.error("Error al obtener turnos futuros del usuario:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getUserHistoryRegistrationsService(userId, year, month) {
  try {
    const registrations = await getUserRegistrationsQuery(userId, year, month);
    const history = registrations.filter((registration) =>
      isShiftPast(registration.shift),
    );

    return [history, null];
  } catch (error) {
    console.error("Error al obtener historial de turnos del usuario:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function saveRegistrationBitacoraService(registrationId, userId, bitacora) {
  try {
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const registrationFound = await registrationRepository.findOne({
      where: { turno_registro_id: Number(registrationId) },
      relations: {
        shift: true,
        user: true,
      },
    });

    if (!registrationFound) return [null, "Registro no encontrado"];

    if (Number(userId) !== Number(registrationFound.user?.id_usuario)) {
      return [null, "No puedes actualizar la bitacora de otro usuario"];
    }

    if (!isShiftCurrent(registrationFound.shift)) {
      return [null, "La bitacora solo puede registrarse durante el turno vigente"];
    }

    registrationFound.bitacora = bitacora;
    const updatedRegistration = await registrationRepository.save(registrationFound);

    return [updatedRegistration, null];
  } catch (error) {
    console.error("Error al guardar bitacora:", error);
    return [null, "Error interno al guardar la bitacora"];
  }
}

export async function markAttendanceService(registrationId, userId, estado) {
  try {
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);

    const registrationFound = await registrationRepository.findOne({
      where: { turno_registro_id: Number(registrationId) },
      relations: {
        shift: true,
        user: true,
      },
    });

    if (!registrationFound) return [null, "Registro no encontrado"];

    if (Number(userId) !== Number(registrationFound.user?.id_usuario)) {
      return [null, "No puedes marcar asistencia de otro usuario"];
    }

    if (registrationFound.estado === "CANCELADO") {
      return [null, "El registro esta cancelado"];
    }

    if (!isShiftCurrent(registrationFound.shift)) {
      return [null, "Solo puedes marcar asistencia en el turno vigente"];
    }

    if (!registrationFound.bitacora || registrationFound.bitacora.trim().length < 40) {
      return [null, "Debes completar la bitacora antes de marcar asistencia"];
    }

    registrationFound.estado = estado;
    const updatedRegistration = await registrationRepository.save(registrationFound);

    return [updatedRegistration, null];
  } catch (error) {
    console.error("Error al marcar asistencia:", error);
    return [null, "Error interno al marcar asistencia"];
  }
}

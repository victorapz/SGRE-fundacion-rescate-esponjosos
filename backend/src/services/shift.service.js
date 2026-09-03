"use strict";

import { Not } from "typeorm";
import Shift from "../entities/shift.entity.js";
import RegistrationShift from "../entities/registration_shift.js";
import { AppDataSource } from "../config/configDb.js";
import { isShiftFuture } from "../helpers/shiftTime.helper.js";

function getShiftId(query) {
  const shiftId = query?.id ?? query?.id_turno;
  return Number(shiftId);
}

export async function createShiftService(body) {
    try {
        const {
            titulo,
            hora_inicio,
            hora_fin,
            fecha,
            estado,
            cantidad_maxima
        } = body;

        const shiftRepository = AppDataSource.getRepository(Shift);

        const nuevoTurno = shiftRepository.create({
            titulo,
            hora_inicio,
            hora_fin,
      fecha,
            estado,
            cantidad_maxima
        });
        
        await shiftRepository.save(nuevoTurno);
        return [nuevoTurno, null];

    } catch (error) {
        console.error("Error al crear turno:", error);
        return [null, "Error interno al crear turno"];
    }
}


export async function getShiftService(query) {
  try {
    const id_turno = getShiftId(query);
    const shiftRepository = AppDataSource.getRepository(Shift);

    if (!Number.isInteger(id_turno) || id_turno <= 0) {
      return [null, "Id de turno inválido"];
    }

    const shiftFound = await shiftRepository.findOne({
      where: { id_turno },
    });

    if (!shiftFound) return [null, "Turno no encontrado"];

    return [shiftFound, null];
  } catch (error) {
    console.error("Error obtener el turno:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getShiftsService(options = {}) {
  try {
    const shiftRepository = AppDataSource.getRepository(Shift);
    const registrationRepository = AppDataSource.getRepository(RegistrationShift);
    const shifts = await shiftRepository.find();

    if (!shifts || shifts.length === 0) return [null, "No hay turnos"];
    const shiftsData = [];

    for (const shift of shifts) {
      const registrationsCount = await registrationRepository.count({
        where: {
          shift: { id_turno: shift.id_turno },
          estado: Not("CANCELADO"),
        },
      });

      const isFull = registrationsCount >= shift.cantidad_maxima;
      const isAvailable = Boolean(shift.estado) && !isFull && isShiftFuture(shift);

      const shiftData = {
        id_turno: shift.id_turno,
        titulo: shift.titulo,
        hora_inicio: shift.hora_inicio,
        hora_fin: shift.hora_fin,
        fecha: shift.fecha,
        estado: isAvailable,
        cantidad_maxima: shift.cantidad_maxima,
        cupos_disponibles: Math.max(shift.cantidad_maxima - registrationsCount, 0),
      };

      if (!options.onlyAvailable || shiftData.estado) {
        shiftsData.push(shiftData);
      }
    }

    return [shiftsData, null];
  } catch (error) {
    console.error("Error al obtener los turnos:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteShiftService(query) {
  try {
    const id_turno = getShiftId(query);
    const shiftRepository = AppDataSource.getRepository(Shift);

    if (!Number.isInteger(id_turno) || id_turno <= 0) {
      return [null, "Id de turno inválido"];
    }

    const shiftFound = await shiftRepository.findOne({
      where: {
        id_turno,
      },
    });
    if (!shiftFound) return [null, "no se encontro el turno"];

    const shiftDeleted = await shiftRepository.remove(shiftFound);

    return [shiftDeleted, null];
  } catch (error) {
    console.error("Error al eliminar turno, el error es:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateShiftService(query, body) {
  try {
    const id_turno = getShiftId(query);

    const shiftRepository = AppDataSource.getRepository(Shift);

    if (!Number.isInteger(id_turno) || id_turno <= 0) {
      return [null, "Id de turno inválido"];
    }

    const shiftFound = await shiftRepository.findOne({
      where: [
        { id_turno: id_turno }
      ]
    });

    
    if (!shiftFound) return [null, "Turno no encontrado"];


    if (body.titulo) shiftFound.titulo = body.titulo;
    if (body.hora_fin) shiftFound.hora_fin = body.hora_fin;
    if (body.hora_inicio) shiftFound.hora_inicio = body.hora_inicio;
    if (body.fecha) shiftFound.fecha = body.fecha;
    if (body.cantidad_maxima) shiftFound.cantidad_maxima = body.cantidad_maxima;
    if (body.estado !== undefined) shiftFound.estado = body.estado;
    
    
    
    await shiftRepository.save(shiftFound);

    const updatedShift = await shiftRepository.findOne({
        where: { id_turno: shiftFound.id_turno },
    });

    return [updatedShift, null];

  }catch (error) {
    console.error("Error al modificar un turno:", error);
    return [null, "Error interno del servidor"];
  }
}
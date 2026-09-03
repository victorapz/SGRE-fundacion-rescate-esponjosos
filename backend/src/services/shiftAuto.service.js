"use strict";

import { Between, In } from "typeorm";
import Shift from "../entities/shift.entity.js";
import RegistrationShift from "../entities/registration_shift.js";
import { AppDataSource } from "../config/configDb.js";
import { SHIFT_CAPACITY } from "../config/configEnv.js";

const SHIFT_TEMPLATES = [
  { titulo: "MAÑANA", hora_inicio: "09:00", hora_fin: "13:00" },
  { titulo: "TARDE", hora_inicio: "13:00", hora_fin: "18:00" },
  { titulo: "NOCHE", hora_inicio: "18:00", hora_fin: "22:00" },
];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextWeekStartDate() {
  const now = new Date();
  const day = now.getDay();
  const daysUntilNextMonday = (8 - day) % 7 || 7;
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(now.getDate() + daysUntilNextMonday);
  return startDate;
}

function normalizeCapacity(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return Number.isFinite(SHIFT_CAPACITY) && SHIFT_CAPACITY > 0 ? SHIFT_CAPACITY : 5;
}

export async function generarTurnosSemanales(options = {}) {
  const capacidad = normalizeCapacity(options.capacidad);
  const shiftRepository = AppDataSource.getRepository(Shift);
  const startDate = getNextWeekStartDate();
  const shiftsToCreate = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayOffset);
    const fecha = formatDate(currentDate);

    for (const template of SHIFT_TEMPLATES) {
      const existingShift = await shiftRepository.findOne({
        where: {
          fecha,
          titulo: template.titulo,
          hora_inicio: template.hora_inicio,
          hora_fin: template.hora_fin,
        },
      });

      if (!existingShift) {
        shiftsToCreate.push({
          fecha,
          titulo: template.titulo,
          hora_inicio: template.hora_inicio,
          hora_fin: template.hora_fin,
          estado: true,
          cantidad_maxima: capacidad,
        });
      }
    }
  }

  if (shiftsToCreate.length === 0) {
    return { created: 0 };
  }

  const entities = shiftRepository.create(shiftsToCreate);
  await shiftRepository.save(entities);

  return { created: entities.length };
}
function getCurrentWeekStartDate() {
  const now = new Date();
  const currentDay = now.getDay();

  // Domingo es 0, lunes es 1, etc.
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - daysSinceMonday);

  return monday;
}

export async function regenerarTurnosSemanaActual(options = {}) {
  const capacidad = normalizeCapacity(options.capacidad);
  const startDate = getCurrentWeekStartDate();

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const fechaInicio = formatDate(startDate);
  const fechaFin = formatDate(endDate);

  return AppDataSource.transaction(async (manager) => {
    const shiftRepository = manager.getRepository(Shift);
    const registrationRepository = manager.getRepository(RegistrationShift);

    /*
     * 1. Buscar todos los turnos de la semana actual.
     */
    const existingShifts = await shiftRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
      },
    });

    const shiftIds = existingShifts.map((shift) => shift.id_turno);

    /*
     * 2. Eliminar primero las inscripciones relacionadas.
     *
     * Esto evita errores de clave foránea cuando un turno ya tiene
     * voluntarios inscritos.
     */
    let deletedRegistrations = 0;

    if (shiftIds.length > 0) {
      const registrations = await registrationRepository.find({
        where: {
          shift: {
            id_turno: In(shiftIds),
          },
        },
      });

      deletedRegistrations = registrations.length;

      if (registrations.length > 0) {
        await registrationRepository.remove(registrations);
      }

      /*
       * 3. Eliminar los turnos anteriores.
       */
      await shiftRepository.remove(existingShifts);
    }

    /*
     * 4. Crear nuevamente los turnos de lunes a domingo
     * usando SHIFT_TEMPLATES.
     */
    const shiftsToCreate = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayOffset);

      const fecha = formatDate(currentDate);

      for (const template of SHIFT_TEMPLATES) {
        shiftsToCreate.push({
          fecha,
          titulo: template.titulo,
          hora_inicio: template.hora_inicio,
          hora_fin: template.hora_fin,
          estado: true,
          cantidad_maxima: capacidad,
        });
      }
    }

    const newShifts = shiftRepository.create(shiftsToCreate);
    await shiftRepository.save(newShifts);

    return {
      fechaInicio,
      fechaFin,
      deletedShifts: existingShifts.length,
      deletedRegistrations,
      createdShifts: newShifts.length,
      capacidad,
    };
  });
}

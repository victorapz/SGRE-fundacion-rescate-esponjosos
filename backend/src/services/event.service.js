"use strict";

import Event, { EventCategory } from "../entities/event.entity.js";
import { AppDataSource } from "../config/configDb.js";

function getEventId(query) {
  const eventId = query?.id ?? query?.id_evento;
  return Number(eventId);
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function buildEventDateRange({ fecha_inicio, fecha_fin }, currentEvent = null) {
  const startDate = parseTimestamp(fecha_inicio ?? currentEvent?.fecha_inicio);
  const endDate = parseTimestamp(fecha_fin ?? currentEvent?.fecha_fin);

  if (!startDate || !endDate) {
    return [null, null, "Las fechas del evento son invalidas"];
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return [null, null, "La fecha de fin debe ser posterior a la fecha de inicio"];
  }

  return [startDate, endDate, null];
}

function serializeEvent(event) {
  if (!event) {
    return null;
  }

  return {
    id_evento: event.id_evento,
    titulo: event.titulo,
    descripcion: event.descripcion,
    lugar: event.lugar,
    categoria: event.categoria ?? EventCategory.COMUNITARIO,
    fecha_inicio: event.fecha_inicio?.toISOString?.() ?? event.fecha_inicio ?? null,
    fecha_fin: event.fecha_fin?.toISOString?.() ?? event.fecha_fin ?? null,
    todo_el_dia: Boolean(event.todo_el_dia),
    activo: Boolean(event.activo),
    createdAt: event.createdAt?.toISOString?.() ?? event.createdAt ?? null,
    updatedAt: event.updatedAt?.toISOString?.() ?? event.updatedAt ?? null,
  };
}

export async function createEventService(body) {
  try {
    const eventRepository = AppDataSource.getRepository(Event);
    const [fechaInicio, fechaFin, dateError] = buildEventDateRange(body);

    if (dateError) {
      return [null, dateError];
    }

    const nuevoEvento = eventRepository.create({
      titulo: body.titulo,
      descripcion: body.descripcion,
      lugar: body.lugar,
      categoria: body.categoria ?? EventCategory.COMUNITARIO,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      todo_el_dia: Boolean(body.todo_el_dia),
      activo: body.activo ?? true,
    });

    const savedEvent = await eventRepository.save(nuevoEvento);
    return [serializeEvent(savedEvent), null];
  } catch (error) {
    console.error("Error al crear evento:", error);
    return [null, "Error interno al crear evento"];
  }
}

export async function getEventService(query) {
  try {
    const id_evento = getEventId(query);
    const eventRepository = AppDataSource.getRepository(Event);

    if (!Number.isInteger(id_evento) || id_evento <= 0) {
      return [null, "Id de evento invalido"];
    }

    const eventFound = await eventRepository.findOne({
      where: { id_evento },
    });

    if (!eventFound) {
      return [null, "Evento no encontrado"];
    }

    return [serializeEvent(eventFound), null];
  } catch (error) {
    console.error("Error obtener el evento:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function getEventsService() {
  try {
    const eventRepository = AppDataSource.getRepository(Event);
    const events = await eventRepository.find({
      where: { activo: true },
      order: { fecha_inicio: "ASC", id_evento: "ASC" },
    });

    if (!events || events.length === 0) {
      return [null, "No hay eventos"];
    }

    return [events.map(serializeEvent), null];
  } catch (error) {
    console.error("Error al obtener los eventos:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function deleteEventService(query) {
  try {
    const id_evento = getEventId(query);
    const eventRepository = AppDataSource.getRepository(Event);

    if (!Number.isInteger(id_evento) || id_evento <= 0) {
      return [null, "Id de evento invalido"];
    }

    const eventFound = await eventRepository.findOne({
      where: { id_evento },
    });

    if (!eventFound) {
      return [null, "No se encontro el evento"];
    }

    eventFound.activo = false;
    const eventDeleted = await eventRepository.save(eventFound);

    return [serializeEvent(eventDeleted), null];
  } catch (error) {
    console.error("Error al eliminar evento, el error es:", error);
    return [null, "Error interno del servidor"];
  }
}

export async function updateEventService(query, body) {
  try {
    const id_evento = getEventId(query);
    const eventRepository = AppDataSource.getRepository(Event);

    if (!Number.isInteger(id_evento) || id_evento <= 0) {
      return [null, "Id de evento invalido"];
    }

    const eventFound = await eventRepository.findOne({
      where: { id_evento },
    });

    if (!eventFound) {
      return [null, "Evento no encontrado"];
    }

    const [fechaInicio, fechaFin, dateError] = buildEventDateRange(body, eventFound);
    if (dateError) {
      return [null, dateError];
    }

    if (body.titulo !== undefined) eventFound.titulo = body.titulo;
    if (body.descripcion !== undefined) eventFound.descripcion = body.descripcion;
    if (body.lugar !== undefined) eventFound.lugar = body.lugar;
    if (body.categoria !== undefined) eventFound.categoria = body.categoria;
    if (body.todo_el_dia !== undefined) eventFound.todo_el_dia = Boolean(body.todo_el_dia);
    if (body.activo !== undefined) eventFound.activo = Boolean(body.activo);
    eventFound.fecha_inicio = fechaInicio;
    eventFound.fecha_fin = fechaFin;

    const updatedEvent = await eventRepository.save(eventFound);
    return [serializeEvent(updatedEvent), null];
  } catch (error) {
    console.error("Error al modificar un evento:", error);
    return [null, "Error interno del servidor"];
  }
}

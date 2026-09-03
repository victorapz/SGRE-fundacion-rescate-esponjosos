"use strict";

import {
  eventCreateValidation,
  eventQueryValidation,
  eventUpdateBodyValidation,
} from "../validations/event.validation.js";

import {
  createEventService,
  deleteEventService,
  getEventsService,
  getEventService,
  updateEventService,
} from "../services/event.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export const createEvent = async (req, res) => {
    try {
        const { body } = req;

        const { error } = eventCreateValidation.validate(body, { abortEarly: false });

        if (error) return handleErrorClient(res, 400, "Error de validación", error.message);

        const [event, errorEvent] = await createEventService(body);

        if (errorEvent) return handleErrorClient(res, 400, errorEvent);

        handleSuccess(res, 201, "Evento creado correctamente", event);
        }catch (error) {
        handleErrorServer(res, 500, error.message);
        } 
};


export async function getEvent(req, res) {
  try {
    const { id } = req.query;

    const { error } = eventQueryValidation.validate({ id });

    if (error) return handleErrorClient(res, 400, "Error de validación", error.message);

    const [event, errorEvent] = await getEventService({ id });

    if (errorEvent) return handleErrorClient(res, 404, errorEvent);

    handleSuccess(res, 200, "Evento encontrado", event);
    } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getEvents(req, res) {
  try {
    const [events, errorEvents] = await getEventsService();

    if (errorEvents) {
      return handleSuccess(res, 200, "No hay eventos", []);
    }

    return handleSuccess(res, 200, "Eventos encontrados", events ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}



export async function updateEvent(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = eventQueryValidation.validate({
      id
    });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = eventUpdateBodyValidation.validate(body, { abortEarly: false });

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [event, eventError] = await updateEventService({ id }, body);

    if (eventError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el evento",
        eventError,
      );

    handleSuccess(res, 200, "Evento modificado correctamente", event);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteEvent(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = eventQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const [eventDelete, errorEventDelete] = await deleteEventService({ id });


    if (errorEventDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el evento",
        errorEventDelete,
      );

    handleSuccess(res, 200, "Evento eliminado correctamente", eventDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

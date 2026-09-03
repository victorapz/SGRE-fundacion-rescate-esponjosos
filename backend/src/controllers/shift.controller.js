"use strict";

import {
  shiftCreateValidation,
  shiftQueryValidation,
  shiftUpdateBodyValidation,
} from "../validations/shift.validation.js";

import {
  createShiftService,
  deleteShiftService,
  getShiftsService,
  getShiftService,
  updateShiftService,
} from "../services/shift.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export const createShift = async (req, res) => {
  try {
    const { body } = req;

    let validatedBody;
    try {
      validatedBody = await shiftCreateValidation.validateAsync(body);
    } catch (validationError) {
      return handleErrorClient(res, 400, "Error de validación", validationError.message);
    }

    const [shift, errorShift] = await createShiftService(validatedBody);

    if (errorShift) return handleErrorClient(res, 400, errorShift);

    handleSuccess(res, 201, "Turno creado correctamente", shift);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
};

export async function getShift(req, res) {
  try {
    const { id } = req.query;

    const { error } = shiftQueryValidation.validate({ id });

    if (error) return handleErrorClient(res, 400, "Error de validación", error.message);

    const [shift, errorShift] = await getShiftService({ id });

    if (errorShift) return handleErrorClient(res, 404, errorShift);

    handleSuccess(res, 200, "Turno encontrado", shift);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getShifts(req, res) {
  try {
    const onlyAvailable = String(req.query?.available).toLowerCase() === "true";
    const [shifts, errorShifts] = await getShiftsService({ onlyAvailable });

    if (errorShifts) {
      return handleSuccess(res, 200, "No hay turnos", []);
    }

    return handleSuccess(res, 200, "Turnos encontrados", shifts ?? []);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateShift(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;
    const { error: queryError } = shiftQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    let validatedBody;
    try {
      validatedBody = await shiftUpdateBodyValidation.validateAsync(body);
    } catch (validationError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        validationError.message,
      );
    }

    const [shift, shiftError] = await updateShiftService({ id }, validatedBody);

    if (shiftError) {
      const statusCode = shiftError === "Turno no encontrado" ? 404 : 400;
      return handleErrorClient(
        res,
        statusCode,
        "Error modificando el turno",
        shiftError,
      );
    }

    handleSuccess(res, 200, "Turno modificado correctamente", shift);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteShift(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = shiftQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const [shiftDelete, errorShiftDelete] = await deleteShiftService({ id });

    if (errorShiftDelete) {
      return handleErrorClient(
        res,
        404,
        "Error eliminando el turno",
        errorShiftDelete,
      );
    }

    handleSuccess(res, 200, "Turno eliminado correctamente", shiftDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  veterinarianCreateValidation,
  veterinarianListQueryValidation,
  veterinarianQueryValidation,
  veterinarianUpdateBodyValidation,
} from "../../validations/veterinarian.validation.js";

import {
  createVeterinarianService,
  deleteVeterinarianService,
  getVeterinariansService,
  getVeterinarianService,
  updateVeterinarianService,
} from "../../services/animalConcept/veterinarian.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createVeterinarian(req, res) {
  try {
    const { body } = req;

    const { error } = veterinarianCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [veterinarian, errorVeterinarian] =
      await createVeterinarianService(body);

    if (errorVeterinarian)
      return handleErrorClient(res, 400, errorVeterinarian);

    handleSuccess(res, 201, "Veterinario creado correctamente", veterinarian);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVeterinarian(req, res) {
  try {
    const { id } = req.query;

    const { error } = veterinarianQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [veterinarian, errorVeterinarian] =
      await getVeterinarianService({ id });

    if (errorVeterinarian)
      return handleErrorClient(res, 404, errorVeterinarian);

    handleSuccess(res, 200, "Veterinario encontrado", veterinarian);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVeterinarians(req, res) {
  try {
    const { error } = veterinarianListQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [veterinarians, errorVeterinarians] =
      await getVeterinariansService(req.query);

    if (errorVeterinarians)
      return handleErrorClient(res, 404, errorVeterinarians);

    veterinarians.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Veterinarios encontrados", veterinarians);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateVeterinarian(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = veterinarianQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = veterinarianUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [veterinarian, veterinarianError] =
      await updateVeterinarianService({ id }, body);

    if (veterinarianError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el veterinario",
        veterinarianError,
      );

    handleSuccess(res, 200, "Veterinario modificado correctamente", veterinarian);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteVeterinarian(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = veterinarianQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [veterinarianDelete, errorVeterinarianDelete] =
      await deleteVeterinarianService({ id });

    if (errorVeterinarianDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el veterinario",
        errorVeterinarianDelete,
      );

    handleSuccess(res, 200, "Veterinario eliminado correctamente", veterinarianDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  locationCreateValidation,
  locationQueryValidation,
  locationUpdateBodyValidation,
} from "../../validations/location.validation.js";

import {
  createLocationService,
  deleteLocationService,
  getLocationService,
  getLocationsService,
  updateLocationService,
} from "../../services/inventoryConcept/location.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createLocation(req, res) {
  try {
    const { body } = req;

    const { error } = locationCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [location, errorLocation] = await createLocationService(body);

    if (errorLocation) return handleErrorClient(res, 400, errorLocation);

    handleSuccess(res, 201, "Ubicación creada correctamente", location);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getLocation(req, res) {
  try {
    const { ubicacion_id } = req.query;

    const { error } = locationQueryValidation.validate({ ubicacion_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [location, errorLocation] = await getLocationService({ ubicacion_id });

    if (errorLocation) return handleErrorClient(res, 404, errorLocation);

    handleSuccess(res, 200, "Ubicación encontrada", location);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getLocations(req, res) {
  try {
    const [locations, errorLocations] = await getLocationsService(req.query);

    if (errorLocations) return handleErrorClient(res, 404, errorLocations);

    locations.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Ubicaciones encontradas", locations);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateLocation(req, res) {
  try {
    const { ubicacion_id } = req.query;
    const { body } = req;

    const { error: queryError } = locationQueryValidation.validate({ ubicacion_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const { error: bodyError } = locationUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [location, errorLocation] = await updateLocationService(
      { ubicacion_id },
      body,
    );

    if (errorLocation)
      return handleErrorClient(
        res,
        400,
        "Error modificando la ubicación",
        errorLocation,
      );

    handleSuccess(res, 200, "Ubicación modificada correctamente", location);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteLocation(req, res) {
  try {
    const { ubicacion_id } = req.query;

    const { error: queryError } = locationQueryValidation.validate({ ubicacion_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const [locationDeleted, errorLocationDeleted] = await deleteLocationService({
      ubicacion_id,
    });

    if (errorLocationDeleted)
      return handleErrorClient(
        res,
        400,
        "Error eliminando la ubicación",
        errorLocationDeleted,
      );

    handleSuccess(res, 200, "Ubicación eliminada correctamente", locationDeleted);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  unitOfMeasureCreateValidation,
  unitOfMeasureQueryValidation,
  unitOfMeasureUpdateBodyValidation,
} from "../../validations/unit_of_measure.validation.js";

import {
  createUnitOfMeasureService,
  deleteUnitOfMeasureService,
  getUnitOfMeasureService,
  getUnitsOfMeasureService,
  updateUnitOfMeasureService,
} from "../../services/inventoryConcept/unit_of_measure.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createUnitOfMeasure(req, res) {
  try {
    const { body } = req;

    const { error } = unitOfMeasureCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [unitOfMeasure, errorUnitOfMeasure] = await createUnitOfMeasureService(body);

    if (errorUnitOfMeasure) return handleErrorClient(res, 400, errorUnitOfMeasure);

    handleSuccess(res, 201, "Unidad de medida creada correctamente", unitOfMeasure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getUnitOfMeasure(req, res) {
  try {
    const { unidad_medida_id } = req.query;

    const { error } = unitOfMeasureQueryValidation.validate({ unidad_medida_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [unitOfMeasure, errorUnitOfMeasure] = await getUnitOfMeasureService({
      unidad_medida_id,
    });

    if (errorUnitOfMeasure) return handleErrorClient(res, 404, errorUnitOfMeasure);

    handleSuccess(res, 200, "Unidad de medida encontrada", unitOfMeasure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getUnitsOfMeasure(req, res) {
  try {
    const [unitsOfMeasure, errorUnitsOfMeasure] = await getUnitsOfMeasureService();

    if (errorUnitsOfMeasure) return handleErrorClient(res, 404, errorUnitsOfMeasure);

    unitsOfMeasure.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Unidades de medida encontradas", unitsOfMeasure);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateUnitOfMeasure(req, res) {
  try {
    const { unidad_medida_id } = req.query;
    const { body } = req;

    const { error: queryError } = unitOfMeasureQueryValidation.validate({
      unidad_medida_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const { error: bodyError } = unitOfMeasureUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [unitOfMeasure, errorUnitOfMeasure] = await updateUnitOfMeasureService(
      { unidad_medida_id },
      body,
    );

    if (errorUnitOfMeasure)
      return handleErrorClient(
        res,
        400,
        "Error modificando la unidad de medida",
        errorUnitOfMeasure,
      );

    handleSuccess(
      res,
      200,
      "Unidad de medida modificada correctamente",
      unitOfMeasure,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteUnitOfMeasure(req, res) {
  try {
    const { unidad_medida_id } = req.query;

    const { error: queryError } = unitOfMeasureQueryValidation.validate({
      unidad_medida_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const [unitOfMeasureDeleted, errorUnitOfMeasureDeleted] =
      await deleteUnitOfMeasureService({ unidad_medida_id });

    if (errorUnitOfMeasureDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando la unidad de medida",
        errorUnitOfMeasureDeleted,
      );

    handleSuccess(
      res,
      200,
      "Unidad de medida eliminada correctamente",
      unitOfMeasureDeleted,
    );
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

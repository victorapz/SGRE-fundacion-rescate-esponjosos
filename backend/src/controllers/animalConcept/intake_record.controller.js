"use strict";

import {
  intakeRecordCreateValidation,
  intakeRecordQueryValidation,
  intakeRecordUpdateBodyValidation,
} from "../../validations/intake_record.validation.js";

import {
  createIntakeRecordService,
  deleteIntakeRecordService,
  getIntakeRecordsService,
  getIntakeRecordService,
  updateIntakeRecordService,
} from "../../services/animalConcept/intake_record.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createIntakeRecord(req, res) {
  try {
    const { body } = req;

    const { error } = intakeRecordCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [record, errorRecord] = await createIntakeRecordService(body);

    if (errorRecord) return handleErrorClient(res, 400, errorRecord);

    handleSuccess(res, 201, "Registro creado correctamente", record);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getIntakeRecord(req, res) {
  try {
    const { id } = req.query;

    const { error } = intakeRecordQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [record, errorRecord] = await getIntakeRecordService({ id });

    if (errorRecord) return handleErrorClient(res, 404, errorRecord);

    handleSuccess(res, 200, "Registro encontrado", record);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getIntakeRecords(req, res) {
  try {
    const [records, errorRecords] = await getIntakeRecordsService();

    if (errorRecords) return handleErrorClient(res, 404, errorRecords);

    records.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Registros encontrados", records);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateIntakeRecord(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = intakeRecordQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = intakeRecordUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [record, recordError] = await updateIntakeRecordService({ id }, body);

    if (recordError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el registro",
        recordError,
      );

    handleSuccess(res, 200, "Registro modificado correctamente", record);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteIntakeRecord(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = intakeRecordQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [recordDelete, errorRecordDelete] = await deleteIntakeRecordService({ id });

    if (errorRecordDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el registro",
        errorRecordDelete,
      );

    handleSuccess(res, 200, "Registro eliminado correctamente", recordDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

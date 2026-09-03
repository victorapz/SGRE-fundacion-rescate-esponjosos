"use strict";

import {
  vetClinicCreateValidation,
  vetClinicListQueryValidation,
  vetClinicQueryValidation,
  vetClinicUpdateBodyValidation,
} from "../../validations/vet_clinic.validation.js";

import {
  createVetClinicService,
  deleteVetClinicService,
  getVetClinicsService,
  getVetClinicService,
  updateVetClinicService,
} from "../../services/animalConcept/vet_clinic.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createVetClinic(req, res) {
  try {
    const { body } = req;

    const { error } = vetClinicCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [clinic, errorClinic] = await createVetClinicService(body);

    if (errorClinic) return handleErrorClient(res, 400, errorClinic);

    handleSuccess(res, 201, "Clinica creada correctamente", clinic);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVetClinic(req, res) {
  try {
    const { id } = req.query;

    const { error } = vetClinicQueryValidation.validate({ id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [clinic, errorClinic] = await getVetClinicService({ id });

    if (errorClinic) return handleErrorClient(res, 404, errorClinic);

    handleSuccess(res, 200, "Clinica encontrada", clinic);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getVetClinics(req, res) {
  try {
    const { error } = vetClinicListQueryValidation.validate(req.query);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [clinics, errorClinics] = await getVetClinicsService(req.query);

    if (errorClinics) return handleErrorClient(res, 404, errorClinics);

    clinics.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Clinicas encontradas", clinics);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateVetClinic(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = vetClinicQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = vetClinicUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [clinic, clinicError] = await updateVetClinicService({ id }, body);

    if (clinicError)
      return handleErrorClient(
        res,
        400,
        "Error modificando la clinica",
        clinicError,
      );

    handleSuccess(res, 200, "Clinica modificada correctamente", clinic);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteVetClinic(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = vetClinicQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const [clinicDelete, errorClinicDelete] =
      await deleteVetClinicService({ id });

    if (errorClinicDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando la clinica",
        errorClinicDelete,
      );

    handleSuccess(res, 200, "Clinica eliminada correctamente", clinicDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

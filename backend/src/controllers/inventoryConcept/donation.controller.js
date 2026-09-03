"use strict";

import {
  donationCreateValidation,
  donationQueryValidation,
  donationUpdateBodyValidation,
} from "../../validations/donation.validation.js";

import {
  createDonationService,
  deleteDonationService,
  getDonationService,
  getDonationsService,
  updateDonationService,
} from "../../services/inventoryConcept/donation.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createDonation(req, res) {
  try {
    const { body } = req;

    const { error } = donationCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [donation, errorDonation] = await createDonationService(body);

    if (errorDonation) return handleErrorClient(res, 400, errorDonation);

    handleSuccess(res, 201, "Donación creada correctamente", donation);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getDonation(req, res) {
  try {
    const { donacion_id } = req.query;

    const { error } = donationQueryValidation.validate({ donacion_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [donation, errorDonation] = await getDonationService({ donacion_id });

    if (errorDonation) return handleErrorClient(res, 404, errorDonation);

    handleSuccess(res, 200, "Donación encontrada", donation);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getDonations(req, res) {
  try {
    const [donations, errorDonations] = await getDonationsService();

    if (errorDonations) return handleErrorClient(res, 404, errorDonations);

    donations.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Donaciones encontradas", donations);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateDonation(req, res) {
  try {
    const { donacion_id } = req.query;
    const { body } = req;

    const { error: queryError } = donationQueryValidation.validate({ donacion_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const { error: bodyError } = donationUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [donation, errorDonation] = await updateDonationService(
      { donacion_id },
      body,
    );

    if (errorDonation)
      return handleErrorClient(res, 400, "Error modificando la donación", errorDonation);

    handleSuccess(res, 200, "Donación modificada correctamente", donation);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteDonation(req, res) {
  try {
    const { donacion_id } = req.query;

    const { error: queryError } = donationQueryValidation.validate({ donacion_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const [donationDeleted, errorDonationDeleted] = await deleteDonationService({
      donacion_id,
    });

    if (errorDonationDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando la donación",
        errorDonationDeleted,
      );

    handleSuccess(res, 200, "Donación eliminada correctamente", donationDeleted);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

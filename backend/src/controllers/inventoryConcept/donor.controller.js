"use strict";

import {
  donorCreateValidation,
  donorQueryValidation,
  donorUpdateBodyValidation,
} from "../../validations/donor.validation.js";
import {
  createDonorService,
  deleteDonorService,
  getDonorService,
  getDonorsService,
  updateDonorService,
} from "../../services/inventoryConcept/donor.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createDonor(req, res) {
  try {
    const { error } = donorCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donor, donorError] = await createDonorService(req.body);
    if (donorError) return handleErrorClient(res, 400, donorError);

    return handleSuccess(res, 201, "Donante creado correctamente", donor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getDonor(req, res) {
  try {
    const { donante_id } = req.query;
    const { error } = donorQueryValidation.validate({ donante_id });
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donor, donorError] = await getDonorService({ donante_id });
    if (donorError) return handleErrorClient(res, 404, donorError);

    return handleSuccess(res, 200, "Donante encontrado", donor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getDonors(req, res) {
  try {
    const [donors, donorError] = await getDonorsService();
    if (donorError) return handleErrorClient(res, 404, donorError);

    return donors.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Donantes encontrados", donors);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateDonor(req, res) {
  try {
    const { donante_id } = req.query;
    const { error: queryError } = donorQueryValidation.validate({ donante_id });
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = donorUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [donor, donorError] = await updateDonorService({ donante_id }, req.body);
    if (donorError) return handleErrorClient(res, 400, donorError);

    return handleSuccess(res, 200, "Donante modificado correctamente", donor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteDonor(req, res) {
  try {
    const { donante_id } = req.query;
    const { error } = donorQueryValidation.validate({ donante_id });
    if (error) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        error.message,
      );
    }

    const [donor, donorError] = await deleteDonorService({ donante_id });
    if (donorError) return handleErrorClient(res, 400, donorError);

    return handleSuccess(res, 200, "Donante eliminado correctamente", donor);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  donationItemCreateValidation,
  donationItemQueryValidation,
  donationItemUpdateBodyValidation,
  receiveDonationItemsBulkValidation,
  receiveDonationItemValidation,
} from "../../validations/donation_item.validation.js";
import {
  createDonationItemService,
  deleteDonationItemService,
  getDonationItemService,
  getDonationItemsService,
  receiveDonationItemsBulkService,
  receiveDonationItemService,
  updateDonationItemService,
} from "../../services/inventoryConcept/donation_item.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

function buildAuthContext(req) {
  return {
    userId: req.user?.id_usuario,
    permissions: req.permissions || [],
  };
}

export async function createDonationItem(req, res) {
  try {
    const { error } = donationItemCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donationItem, donationItemError] = await createDonationItemService(req.body);
    if (donationItemError) return handleErrorClient(res, 400, donationItemError);

    handleSuccess(res, 201, "Item de donacion creado correctamente", donationItem);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getDonationItem(req, res) {
  try {
    const { error } = donationItemQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donationItem, donationItemError] = await getDonationItemService(req.query);
    if (donationItemError) return handleErrorClient(res, 404, donationItemError);

    handleSuccess(res, 200, "Item de donacion encontrado", donationItem);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getDonationItems(req, res) {
  try {
    const [donationItems, donationItemsError] = await getDonationItemsService();
    if (donationItemsError) return handleErrorClient(res, 404, donationItemsError);

    handleSuccess(res, 200, "Items de donacion encontrados", donationItems);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateDonationItem(req, res) {
  try {
    const { error: queryError } = donationItemQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(res, 400, "Error de validacion en la consulta", queryError.message);
    }

    const { error: bodyError } = donationItemUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(res, 400, "Error de validacion en los datos enviados", bodyError.message);
    }

    const [donationItem, donationItemError] = await updateDonationItemService(
      req.query,
      req.body,
    );

    if (donationItemError) return handleErrorClient(res, 400, donationItemError);
    handleSuccess(res, 200, "Item de donacion modificado correctamente", donationItem);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteDonationItem(req, res) {
  try {
    const { error } = donationItemQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [donationItem, donationItemError] = await deleteDonationItemService(req.query);
    if (donationItemError) return handleErrorClient(res, 400, donationItemError);

    handleSuccess(res, 200, "Item de donacion eliminado correctamente", donationItem);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function receiveDonationItem(req, res) {
  try {
    const { error } = receiveDonationItemValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, receiveError] = await receiveDonationItemService(
      req.body,
      buildAuthContext(req),
    );

    if (receiveError) return handleErrorClient(res, 400, receiveError);
    handleSuccess(res, 201, "Recepcion de item de donacion registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function receiveDonationItemsBulk(req, res) {
  try {
    const { error } = receiveDonationItemsBulkValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [result, receiveError] = await receiveDonationItemsBulkService(
      req.body,
      buildAuthContext(req),
    );

    if (receiveError) return handleErrorClient(res, 400, receiveError);
    handleSuccess(res, 201, "Recepcion masiva de donacion registrada correctamente", result);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  itemCreateValidation,
  itemQueryValidation,
  itemUpdateBodyValidation,
} from "../../validations/item.validation.js";

import {
  createItemService,
  deleteItemService,
  getItemService,
  getItemsService,
  updateItemService,
} from "../../services/inventoryConcept/item.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createItem(req, res) {
  try {
    const { body } = req;

    const { error } = itemCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [item, errorItem] = await createItemService(body);

    if (errorItem) return handleErrorClient(res, 400, errorItem);

    handleSuccess(res, 201, "Ítem creado correctamente", item);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getItem(req, res) {
  try {
    const { item_id } = req.query;

    const { error } = itemQueryValidation.validate({ item_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validación", error.message);

    const [item, errorItem] = await getItemService({ item_id });

    if (errorItem) return handleErrorClient(res, 404, errorItem);

    handleSuccess(res, 200, "Ítem encontrado", item);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getItems(req, res) {
  try {
    const [items, errorItems] = await getItemsService();

    if (errorItems) return handleErrorClient(res, 404, errorItems);

    items.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Ítems encontrados", items);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateItem(req, res) {
  try {
    const { item_id } = req.query;
    const { body } = req;

    const { error: queryError } = itemQueryValidation.validate({ item_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const { error: bodyError } = itemUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [item, errorItem] = await updateItemService({ item_id }, body);

    if (errorItem)
      return handleErrorClient(res, 400, "Error modificando el ítem", errorItem);

    handleSuccess(res, 200, "Ítem modificado correctamente", item);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteItem(req, res) {
  try {
    const { item_id } = req.query;

    const { error: queryError } = itemQueryValidation.validate({ item_id });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );

    const [itemDeleted, errorItemDeleted] = await deleteItemService({ item_id });

    if (errorItemDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el ítem",
        errorItemDeleted,
      );

    handleSuccess(res, 200, "Ítem eliminado correctamente", itemDeleted);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import {
  itemCategoryCreateValidation,
  itemCategoryQueryValidation,
  itemCategoryUpdateBodyValidation,
} from "../../validations/item_category.validation.js";

import {
  createItemCategoryService,
  deleteItemCategoryService,
  getItemCategoryService,
  getItemCategoriesService,
  updateItemCategoryService,
} from "../../services/inventoryConcept/item_category.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createItemCategory(req, res) {
  try {
    const { body } = req;

    const { error } = itemCategoryCreateValidation.validate(body);

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [itemCategory, errorItemCategory] = await createItemCategoryService(body);

    if (errorItemCategory) return handleErrorClient(res, 400, errorItemCategory);

    handleSuccess(res, 201, "Categoria creada correctamente", itemCategory);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getItemCategory(req, res) {
  try {
    const { categoria_item_id } = req.query;

    const { error } = itemCategoryQueryValidation.validate({ categoria_item_id });

    if (error)
      return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [itemCategory, errorItemCategory] = await getItemCategoryService({
      categoria_item_id,
    });

    if (errorItemCategory) return handleErrorClient(res, 404, errorItemCategory);

    handleSuccess(res, 200, "Categoria encontrada", itemCategory);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getItemCategories(req, res) {
  try {
    const [itemCategories, errorItemCategories] = await getItemCategoriesService();

    if (errorItemCategories) return handleErrorClient(res, 404, errorItemCategories);

    itemCategories.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Categorías encontradas", itemCategories);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateItemCategory(req, res) {
  try {
    const { categoria_item_id } = req.query;
    const { body } = req;

    const { error: queryError } = itemCategoryQueryValidation.validate({
      categoria_item_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const { error: bodyError } = itemCategoryUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );

    const [itemCategory, errorItemCategory] = await updateItemCategoryService(
      { categoria_item_id },
      body,
    );

    if (errorItemCategory)
      return handleErrorClient(
        res,
        400,
        "Error modificando la categoria",
        errorItemCategory,
      );

    handleSuccess(res, 200, "Categoria modificada correctamente", itemCategory);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteItemCategory(req, res) {
  try {
    const { categoria_item_id } = req.query;

    const { error: queryError } = itemCategoryQueryValidation.validate({
      categoria_item_id,
    });

    if (queryError)
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );

    const [itemCategoryDeleted, errorItemCategoryDeleted] =
      await deleteItemCategoryService({ categoria_item_id });

    if (errorItemCategoryDeleted)
      return handleErrorClient(
        res,
        404,
        "Error eliminando la categoria",
        errorItemCategoryDeleted,
      );

    handleSuccess(res, 200, "Categoria eliminada correctamente", itemCategoryDeleted);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

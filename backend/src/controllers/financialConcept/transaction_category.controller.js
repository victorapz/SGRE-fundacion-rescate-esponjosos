"use strict";

import {
  transactionCategoryCreateValidation,
  transactionCategoryListValidation,
  transactionCategoryQueryValidation,
  transactionCategoryUpdateBodyValidation,
} from "../../validations/transaction_category.validation.js";
import {
  createTransactionCategoryService,
  deleteTransactionCategoryService,
  getTransactionCategoriesService,
  getTransactionCategoryService,
  updateTransactionCategoryService,
} from "../../services/financialConcept/transactionCategory.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createTransactionCategory(req, res) {
  try {
    const { error } = transactionCategoryCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [category, categoryError] = await createTransactionCategoryService(req.body);
    if (categoryError) return handleErrorClient(res, 400, categoryError);

    return handleSuccess(res, 201, "Categoria de transaccion creada correctamente", category);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTransactionCategory(req, res) {
  try {
    const { error } = transactionCategoryQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [category, categoryError] = await getTransactionCategoryService(req.query);
    if (categoryError) return handleErrorClient(res, 404, categoryError);

    return handleSuccess(res, 200, "Categoria de transaccion encontrada", category);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTransactionCategories(req, res) {
  try {
    const { error } = transactionCategoryListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [categories, categoriesError] = await getTransactionCategoriesService(req.query);
    if (categoriesError) return handleErrorClient(res, 400, categoriesError);

    return handleSuccess(res, 200, "Categorías de transaccion encontradas", categories);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateTransactionCategory(req, res) {
  try {
    const { error: queryError } = transactionCategoryQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = transactionCategoryUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [category, categoryError] = await updateTransactionCategoryService(
      req.query,
      req.body,
    );

    if (categoryError) return handleErrorClient(res, 400, categoryError);

    return handleSuccess(res, 200, "Categoria de transaccion actualizada correctamente", category);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteTransactionCategory(req, res) {
  try {
    const { error } = transactionCategoryQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [category, categoryError] = await deleteTransactionCategoryService(req.query);
    if (categoryError) return handleErrorClient(res, 400, categoryError);

    return handleSuccess(res, 200, "Categoria de transaccion desactivada correctamente", category);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

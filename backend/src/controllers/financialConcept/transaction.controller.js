"use strict";

import {
  transactionCancelBodyValidation,
  transactionCreateValidation,
  transactionListValidation,
  transactionQueryValidation,
  transactionUpdateBodyValidation,
} from "../../validations/transaction.validation.js";
import {
  cancelTransactionService,
  createTransactionService,
  getTransactionService,
  getTransactionsService,
  updateTransactionService,
} from "../../services/financialConcept/transaction.service.js";
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

export async function createTransaction(req, res) {
  try {
    const { error } = transactionCreateValidation.validate(req.body);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [transaction, transactionError] = await createTransactionService(
      req.body,
      buildAuthContext(req),
    );

    if (transactionError) return handleErrorClient(res, 400, transactionError);

    return handleSuccess(res, 201, "Transaccion creada correctamente", transaction);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTransaction(req, res) {
  try {
    const { error } = transactionQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [transaction, transactionError] = await getTransactionService(req.query);
    if (transactionError) return handleErrorClient(res, 404, transactionError);

    return handleSuccess(res, 200, "Transaccion encontrada", transaction);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getTransactions(req, res) {
  try {
    const { error } = transactionListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [transactions, transactionError] = await getTransactionsService(req.query);
    if (transactionError) return handleErrorClient(res, 400, transactionError);

    return handleSuccess(res, 200, "Transacciones encontradas", transactions);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateTransaction(req, res) {
  try {
    const { error: queryError } = transactionQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = transactionUpdateBodyValidation.validate(req.body);
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [transaction, transactionError] = await updateTransactionService(
      req.query,
      req.body,
      buildAuthContext(req),
    );

    if (transactionError) return handleErrorClient(res, 400, transactionError);

    return handleSuccess(res, 200, "Transaccion actualizada correctamente", transaction);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function cancelTransaction(req, res) {
  try {
    const { error: queryError } = transactionQueryValidation.validate(req.query);
    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = transactionCancelBodyValidation.validate(req.body || {});
    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [transaction, transactionError] = await cancelTransactionService(req.query, req.body);
    if (transactionError) return handleErrorClient(res, 400, transactionError);

    return handleSuccess(res, 200, "Transaccion anulada correctamente", transaction);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

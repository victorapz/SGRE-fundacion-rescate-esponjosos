"use strict";

import {
  publicMonthlyAccountingPublishedListValidation,
  publicMonthlyAccountingReportIdValidation,
} from "../validations/public_monthly_accounting_report.validation.js";
import {
  downloadPublishedPublicMonthlyAccountingReportService,
  getPublishedPublicMonthlyAccountingReportByIdService,
  listPublishedPublicMonthlyAccountingReportsService,
} from "../services/financialConcept/public_monthly_accounting_report.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

function buildClientError(error, fallbackStatus = 400) {
  if (!error) {
    return { statusCode: fallbackStatus, message: "Error de validacion." };
  }

  if (typeof error === "string") {
    return { statusCode: fallbackStatus, message: error };
  }

  return {
    statusCode: error.statusCode || fallbackStatus,
    message: error.message || "Error de validacion.",
  };
}

function pipeFileStream(res, payload) {
  res.setHeader("Content-Type", payload.contentType);
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (payload.contentDisposition) {
    res.setHeader("Content-Disposition", payload.contentDisposition);
  }

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo PDF publico contable:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el archivo solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export async function getPublicAccountingReports(req, res) {
  try {
    const { error, value } = publicMonthlyAccountingPublishedListValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await listPublishedPublicMonthlyAccountingReportsService(value);

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informes contables publicos encontrados", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicAccountingReportById(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({ id: req.params.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getPublishedPublicMonthlyAccountingReportByIdService(
      req.params.id,
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informe contable publico encontrado", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function downloadPublicAccountingReport(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({ id: req.params.id });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await downloadPublishedPublicMonthlyAccountingReportService(
      req.params.id,
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return pipeFileStream(res, payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

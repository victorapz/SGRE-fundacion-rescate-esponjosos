"use strict";

import {
  publicMonthlyAccountingReportGenerateValidation,
  publicMonthlyAccountingReportIdValidation,
  publicMonthlyAccountingReportListValidation,
} from "../../validations/public_monthly_accounting_report.validation.js";
import {
  archivePublicMonthlyAccountingReportService,
  downloadPublicMonthlyAccountingReportService,
  generatePublicMonthlyAccountingReportService,
  getPublicMonthlyAccountingReportByIdService,
  listPublicMonthlyAccountingReportsService,
  publishPublicMonthlyAccountingReportService,
} from "../../services/financialConcept/public_monthly_accounting_report.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

function buildAuthContext(req) {
  return {
    userId: req.user?.id_usuario,
    user: req.user || null,
    permissions: req.permissions || [],
  };
}

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
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (payload.contentDisposition) {
    res.setHeader("Content-Disposition", payload.contentDisposition);
  }

  payload.stream.on("error", (error) => {
    console.error("Error transmitiendo PDF de informe publico contable:", error);
    if (!res.headersSent) {
      handleErrorServer(res, 500, "No fue posible transmitir el archivo solicitado.");
    } else {
      res.end();
    }
  });

  payload.stream.pipe(res);
}

export async function listPublicMonthlyAccountingReports(req, res) {
  try {
    const { error, value } = publicMonthlyAccountingReportListValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await listPublicMonthlyAccountingReportsService(
      value,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informes publicos contables encontrados", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getPublicMonthlyAccountingReportById(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({
      id: req.params.id,
    });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await getPublicMonthlyAccountingReportByIdService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 404);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informe publico contable encontrado", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function generatePublicMonthlyAccountingReport(req, res) {
  try {
    const { error, value } = publicMonthlyAccountingReportGenerateValidation.validate(req.body);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await generatePublicMonthlyAccountingReportService(
      value,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 201, "Informe publico contable generado correctamente", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function publishPublicMonthlyAccountingReport(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({
      id: req.params.id,
    });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await publishPublicMonthlyAccountingReportService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informe publico contable publicado correctamente", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function archivePublicMonthlyAccountingReport(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({
      id: req.params.id,
    });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await archivePublicMonthlyAccountingReportService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return handleSuccess(res, 200, "Informe publico contable archivado correctamente", payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function downloadPublicMonthlyAccountingReport(req, res) {
  try {
    const { error } = publicMonthlyAccountingReportIdValidation.validate({
      id: req.params.id,
    });
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [payload, serviceError] = await downloadPublicMonthlyAccountingReportService(
      req.params.id,
      buildAuthContext(req),
    );

    if (serviceError) {
      const clientError = buildClientError(serviceError, 400);
      return handleErrorClient(res, clientError.statusCode, clientError.message);
    }

    return pipeFileStream(res, payload);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

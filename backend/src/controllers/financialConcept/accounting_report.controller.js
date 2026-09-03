"use strict";

import { accountingTransactionsReportPreviewValidation } from "../../validations/accounting_report.validation.js";
import {
  accountingTransactionsReportExportValidation,
} from "../../validations/accounting_report.validation.js";
import {
  getAccountingTransactionsReportExportService,
  getAccountingTransactionsReportPreviewService,
} from "../../services/financialConcept/accounting_report.service.js";
import {
  payableReportExportValidation,
  payableReportPreviewValidation,
} from "../../validations/payable_report.validation.js";
import {
  getPayablesReportExportService,
  getPayablesReportPreviewService,
} from "../../services/financialConcept/payable_report.service.js";
import {
  applyReportBinaryHeaders,
  assertReportExportWithinLimit,
  buildReportExportFilename,
} from "../../services/reporting/export/report_export.shared.js";
import { generateReportPdfBuffer } from "../../services/reporting/export/report_pdf.exporter.js";
import { generateReportXlsxBuffer } from "../../services/reporting/export/report_xlsx.exporter.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

async function exportReportBinary(res, report, format) {
  assertReportExportWithinLimit(report, format);
  const buffer = format === "pdf"
    ? await generateReportPdfBuffer(report)
    : await generateReportXlsxBuffer(report);
  const filename = buildReportExportFilename(report.report_type, report.filters, format);

  applyReportBinaryHeaders(res, { filename, format });
  return res.status(200).end(buffer);
}

export async function previewAccountingTransactionsReport(req, res) {
  try {
    const { error, value } = accountingTransactionsReportPreviewValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getAccountingTransactionsReportPreviewService(
      value,
      {
        user: req.user || null,
        permissions: req.permissions || [],
      },
    );

    if (reportError) {
      return handleErrorClient(res, 400, reportError);
    }

    return handleSuccess(res, 200, "Preview del informe contable generado correctamente", report);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function exportAccountingTransactionsReport(req, res) {
  try {
    const { error, value } = accountingTransactionsReportExportValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getAccountingTransactionsReportExportService(
      value,
      {
        user: req.user || null,
        permissions: req.permissions || [],
      },
    );

    if (reportError) {
      return handleErrorClient(res, 400, reportError);
    }

    return await exportReportBinary(res, report, value.format);
  } catch (error) {
    if (error.statusCode) {
      return handleErrorClient(res, error.statusCode, error.message);
    }
    return handleErrorServer(res, 500, error.message);
  }
}

export async function previewAccountingPayablesReport(req, res) {
  try {
    const { error, value } = payableReportPreviewValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getPayablesReportPreviewService(
      value,
      {
        user: req.user || null,
        permissions: req.permissions || [],
      },
    );

    if (reportError) {
      return handleErrorClient(res, 400, reportError);
    }

    return handleSuccess(
      res,
      200,
      "Preview del informe de cuentas por pagar generado correctamente",
      report,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function exportAccountingPayablesReport(req, res) {
  try {
    const { error, value } = payableReportExportValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getPayablesReportExportService(
      value,
      {
        user: req.user || null,
        permissions: req.permissions || [],
      },
    );

    if (reportError) {
      return handleErrorClient(res, 400, reportError);
    }

    return await exportReportBinary(res, report, value.format);
  } catch (error) {
    if (error.statusCode) {
      return handleErrorClient(res, error.statusCode, error.message);
    }
    return handleErrorServer(res, 500, error.message);
  }
}

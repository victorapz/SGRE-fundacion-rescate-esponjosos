"use strict";

import {
  inventoryExistenceReportExportValidation,
  inventoryExistenceReportPreviewValidation,
} from "../../validations/inventory_existence_report.validation.js";
import {
  inventoryCountsAdjustmentsReportExportValidation,
  inventoryCountsAdjustmentsReportPreviewValidation,
} from "../../validations/inventory_counts_adjustments_report.validation.js";
import {
  getInventoryExistencesReportExportService,
  getInventoryExistencesReportPreviewService,
} from "../../services/inventoryConcept/inventory_existence_report.service.js";
import {
  getInventoryCountsAdjustmentsReportExportService,
  getInventoryCountsAdjustmentsReportPreviewService,
} from "../../services/inventoryConcept/inventory_counts_adjustments_report.service.js";
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

export async function previewInventoryExistencesReport(req, res) {
  try {
    const { error, value } = inventoryExistenceReportPreviewValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getInventoryExistencesReportPreviewService(
      value,
      {
        userId: req.user?.id_usuario,
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
      "Preview del informe de existencias generado correctamente",
      report,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function exportInventoryExistencesReport(req, res) {
  try {
    const { error, value } = inventoryExistenceReportExportValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getInventoryExistencesReportExportService(
      value,
      {
        userId: req.user?.id_usuario,
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

export async function previewInventoryCountsAdjustmentsReport(req, res) {
  try {
    const { error, value } = inventoryCountsAdjustmentsReportPreviewValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getInventoryCountsAdjustmentsReportPreviewService(
      value,
      {
        userId: req.user?.id_usuario,
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
      "Preview del informe de conteos y ajustes generado correctamente",
      report,
    );
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function exportInventoryCountsAdjustmentsReport(req, res) {
  try {
    const { error, value } = inventoryCountsAdjustmentsReportExportValidation.validate(req.query);
    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [report, reportError] = await getInventoryCountsAdjustmentsReportExportService(
      value,
      {
        userId: req.user?.id_usuario,
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

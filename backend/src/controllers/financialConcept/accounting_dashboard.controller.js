"use strict";

import { accountingDashboardQueryValidation } from "../../validations/accounting_dashboard.validation.js";
import { getAccountingDashboardService } from "../../services/financialConcept/accountingDashboard.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function getAccountingDashboard(req, res) {
  try {
    const { error } = accountingDashboardQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [dashboard, dashboardError] = await getAccountingDashboardService(req.query);
    if (dashboardError) return handleErrorClient(res, 400, dashboardError);

    return handleSuccess(res, 200, "Dashboard contable obtenido correctamente", dashboard);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

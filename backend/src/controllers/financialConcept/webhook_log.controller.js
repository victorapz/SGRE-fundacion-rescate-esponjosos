"use strict";

import {
  webhookLogListValidation,
  webhookLogQueryValidation,
} from "../../validations/webhook_log.validation.js";
import {
  getWebhookLogService,
  getWebhookLogsService,
} from "../../services/financialConcept/webhookLog.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function getWebhookLog(req, res) {
  try {
    const { error } = webhookLogQueryValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [log, logError] = await getWebhookLogService(req.query);
    if (logError) return handleErrorClient(res, 404, logError);

    return handleSuccess(res, 200, "Webhook log encontrado", log);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getWebhookLogs(req, res) {
  try {
    const { error } = webhookLogListValidation.validate(req.query);
    if (error) return handleErrorClient(res, 400, "Error de validacion", error.message);

    const [logs, logError] = await getWebhookLogsService(req.query);
    if (logError) return handleErrorClient(res, 400, logError);

    return handleSuccess(res, 200, "Webhook logs encontrados", logs);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  getWebhookLog,
  getWebhookLogs,
} from "../../controllers/financialConcept/webhook_log.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .get("/", checkRbac("accounting:webhook:read"), getWebhookLogs)
  .get("/detail/", checkRbac("accounting:webhook:read"), getWebhookLog);

export default router;

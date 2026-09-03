"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import { getAccountingDashboard } from "../../controllers/financialConcept/accounting_dashboard.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:dashboard:read"), getAccountingDashboard);

export default router;

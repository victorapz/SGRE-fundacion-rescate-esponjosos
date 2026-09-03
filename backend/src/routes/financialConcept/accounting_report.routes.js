"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import { requireResolvedPermissions } from "../../middlewares/reporting.middleware.js";
import {
  exportAccountingPayablesReport,
  exportAccountingTransactionsReport,
  previewAccountingPayablesReport,
  previewAccountingTransactionsReport,
} from "../../controllers/financialConcept/accounting_report.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get(
  "/transactions",
  checkRbac("accounting:transaction:read"),
  previewAccountingTransactionsReport,
);
router.get(
  "/transactions/export",
  checkRbac("accounting:transaction:read", "accounting:report:export"),
  requireResolvedPermissions("accounting:transaction:read", "accounting:report:export"),
  exportAccountingTransactionsReport,
);
router.get(
  "/payables",
  checkRbac("accounting:payable:read"),
  previewAccountingPayablesReport,
);
router.get(
  "/payables/export",
  checkRbac("accounting:payable:read", "accounting:report:export"),
  requireResolvedPermissions("accounting:payable:read", "accounting:report:export"),
  exportAccountingPayablesReport,
);

export default router;

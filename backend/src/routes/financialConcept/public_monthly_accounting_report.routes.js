"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  archivePublicMonthlyAccountingReport,
  downloadPublicMonthlyAccountingReport,
  generatePublicMonthlyAccountingReport,
  getPublicMonthlyAccountingReportById,
  listPublicMonthlyAccountingReports,
  publishPublicMonthlyAccountingReport,
} from "../../controllers/financialConcept/public_monthly_accounting_report.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:public_report:read"), listPublicMonthlyAccountingReports);
router.get("/:id", checkRbac("accounting:public_report:read"), getPublicMonthlyAccountingReportById);
router.post(
  "/generate",
  checkRbac("accounting:public_report:create"),
  generatePublicMonthlyAccountingReport,
);
router.patch(
  "/:id/publish",
  checkRbac("accounting:public_report:publish"),
  publishPublicMonthlyAccountingReport,
);
router.patch(
  "/:id/archive",
  checkRbac("accounting:public_report:archive"),
  archivePublicMonthlyAccountingReport,
);
router.get(
  "/:id/download",
  checkRbac("accounting:public_report:read"),
  downloadPublicMonthlyAccountingReport,
);

export default router;

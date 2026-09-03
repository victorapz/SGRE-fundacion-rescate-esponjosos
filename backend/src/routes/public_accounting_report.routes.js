"use strict";

import { Router } from "express";
import {
  downloadPublicAccountingReport,
  getPublicAccountingReportById,
  getPublicAccountingReports,
} from "../controllers/public_accounting_report.controller.js";

const router = Router();

router.get("/", getPublicAccountingReports);
router.get("/:id", getPublicAccountingReportById);
router.get("/:id/download", downloadPublicAccountingReport);

export default router;

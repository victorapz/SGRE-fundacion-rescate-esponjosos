"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  requireAnyResolvedPermission,
  requireResolvedPermissions,
} from "../../middlewares/reporting.middleware.js";
import {
  exportInventoryCountsAdjustmentsReport,
  exportInventoryExistencesReport,
  previewInventoryExistencesReport,
  previewInventoryCountsAdjustmentsReport,
} from "../../controllers/inventoryConcept/inventory_report.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get(
  "/existences",
  checkRbac(
    "inventory:inventory_existence:read",
    "inventory:read:any",
    "inventory:read:location",
  ),
  previewInventoryExistencesReport,
);
router.get(
  "/existences/export",
  checkRbac(
    "inventory:inventory_existence:read",
    "inventory:read:any",
    "inventory:read:location",
    "inventory:report:export",
  ),
  requireAnyResolvedPermission(
    "inventory:inventory_existence:read",
    "inventory:read:any",
    "inventory:read:location",
  ),
  requireResolvedPermissions("inventory:report:export"),
  exportInventoryExistencesReport,
);

router.get(
  "/counts-adjustments",
  checkRbac(
    "inventory:stock_count:read",
    "inventory:inventory_adjustment:read",
    "inventory:read:any",
    "inventory:read:location",
  ),
  requireResolvedPermissions(
    "inventory:stock_count:read",
    "inventory:inventory_adjustment:read",
  ),
  previewInventoryCountsAdjustmentsReport,
);
router.get(
  "/counts-adjustments/export",
  checkRbac(
    "inventory:stock_count:read",
    "inventory:inventory_adjustment:read",
    "inventory:report:export",
  ),
  requireResolvedPermissions(
    "inventory:stock_count:read",
    "inventory:inventory_adjustment:read",
    "inventory:report:export",
  ),
  exportInventoryCountsAdjustmentsReport,
);

export default router;

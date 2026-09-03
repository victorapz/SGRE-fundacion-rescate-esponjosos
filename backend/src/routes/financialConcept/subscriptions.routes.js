"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  cancelSubscription,
  getSubscription,
  getSubscriptions,
  syncSubscription,
} from "../../controllers/financialConcept/sponsorship_admin.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:subscription:read"), getSubscriptions);
router.get("/:id", checkRbac("accounting:subscription:read"), getSubscription);
router.post("/:id/sync", checkRbac("accounting:subscription:sync"), syncSubscription);
router.post(
  "/:id/cancel",
  checkRbac("accounting:subscription:cancel"),
  checkRbac("accounting:sponsorship:cancel"),
  cancelSubscription,
);

export default router;

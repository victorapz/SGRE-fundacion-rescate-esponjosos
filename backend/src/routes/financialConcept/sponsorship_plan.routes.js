"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createSponsorshipPlan,
  deleteSponsorshipPlan,
  getSponsorshipPlan,
  getSponsorshipPlans,
  provisionSponsorshipPlanPayPal,
  updateSponsorshipPlan,
} from "../../controllers/financialConcept/sponsorship_plan.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:sponsorship_plan:read"), getSponsorshipPlans);
router.get("/:id", checkRbac("accounting:sponsorship_plan:read"), getSponsorshipPlan);
router.post("/", checkRbac("accounting:sponsorship_plan:create"), createSponsorshipPlan);
router.patch("/:id", checkRbac("accounting:sponsorship_plan:update"), updateSponsorshipPlan);
router.post("/:id/paypal/provision", checkRbac("accounting:sponsorship_plan:update"), provisionSponsorshipPlanPayPal);
router.delete("/:id", checkRbac("accounting:sponsorship_plan:delete"), deleteSponsorshipPlan);

export default router;

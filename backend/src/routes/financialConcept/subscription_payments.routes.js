"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createManualSubscriptionPayment,
  getSubscriptionPayment,
  getSubscriptionPayments,
} from "../../controllers/financialConcept/sponsorship_admin.controller.js";

const router = Router();

router.use(authenticateJwt);

router.post("/", checkRbac("accounting:subscription_payment:create"), createManualSubscriptionPayment);
router.get("/", checkRbac("accounting:subscription_payment:read"), getSubscriptionPayments);
router.get("/:id", checkRbac("accounting:subscription_payment:read"), getSubscriptionPayment);

export default router;

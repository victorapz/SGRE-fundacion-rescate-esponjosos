"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createAccountingDonationRefund,
  getAccountingDonations,
} from "../../controllers/financialConcept/accounting_donation.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:payment_order:read"), getAccountingDonations);
router.post(
  "/:paymentOrderId/refunds",
  checkRbac("accounting:donation_refund:create"),
  createAccountingDonationRefund,
);

export default router;

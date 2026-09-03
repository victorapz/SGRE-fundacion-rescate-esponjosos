"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createPaymentProvider,
  deletePaymentProvider,
  getPaymentProvider,
  getPaymentProviders,
  updatePaymentProvider,
} from "../../controllers/financialConcept/payment_provider.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:payment_provider:create"), createPaymentProvider)
  .get("/", checkRbac("accounting:payment_provider:read"), getPaymentProviders)
  .get("/detail/", checkRbac("accounting:payment_provider:read"), getPaymentProvider)
  .patch("/detail/", checkRbac("accounting:payment_provider:update"), updatePaymentProvider)
  .delete("/detail/", checkRbac("accounting:payment_provider:delete"), deletePaymentProvider);

export default router;

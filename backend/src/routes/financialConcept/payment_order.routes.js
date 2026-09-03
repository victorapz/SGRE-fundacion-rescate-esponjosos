"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  cancelPaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  getPaymentOrders,
  updatePaymentOrder,
} from "../../controllers/financialConcept/payment_order.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:payment_order:create"), createPaymentOrder)
  .get("/", checkRbac("accounting:payment_order:read"), getPaymentOrders)
  .get("/detail/", checkRbac("accounting:payment_order:read"), getPaymentOrder)
  .patch("/detail/", checkRbac("accounting:payment_order:update"), updatePaymentOrder)
  .post("/cancel", checkRbac("accounting:payment_order:cancel"), cancelPaymentOrder);

export default router;

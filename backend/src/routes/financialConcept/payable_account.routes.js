"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  cancelPayableAccount,
  createPayableAccount,
  createPayablePayment,
  getPayableAccount,
  getPayableAccounts,
  updatePayableAccount,
} from "../../controllers/financialConcept/payable_account.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:payable:create"), createPayableAccount)
  .get("/", checkRbac("accounting:payable:read"), getPayableAccounts)
  .get("/detail/", checkRbac("accounting:payable:read"), getPayableAccount)
  .patch("/detail/", checkRbac("accounting:payable:update"), updatePayableAccount)
  .post(
    "/:cuenta_por_pagar_id/payments",
    checkRbac("accounting:payable:pay"),
    createPayablePayment,
  )
  .post("/cancel", checkRbac("accounting:payable:cancel"), cancelPayableAccount);

export default router;

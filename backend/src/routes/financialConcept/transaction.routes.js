"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  cancelTransaction,
  createTransaction,
  getTransaction,
  getTransactions,
  updateTransaction,
} from "../../controllers/financialConcept/transaction.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:transaction:create"), createTransaction)
  .get("/", checkRbac("accounting:transaction:read"), getTransactions)
  .get("/detail/", checkRbac("accounting:transaction:read"), getTransaction)
  .patch("/detail/", checkRbac("accounting:transaction:update"), updateTransaction)
  .post("/cancel", checkRbac("accounting:transaction:cancel"), cancelTransaction);

export default router;

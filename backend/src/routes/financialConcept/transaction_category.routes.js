"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  getTransactionCategories,
  getTransactionCategory,
  updateTransactionCategory,
} from "../../controllers/financialConcept/transaction_category.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:category:create"), createTransactionCategory)
  .get("/", checkRbac("accounting:category:read"), getTransactionCategories)
  .get("/detail/", checkRbac("accounting:category:read"), getTransactionCategory)
  .patch("/detail/", checkRbac("accounting:category:update"), updateTransactionCategory)
  .delete("/detail/", checkRbac("accounting:category:delete"), deleteTransactionCategory);

export default router;

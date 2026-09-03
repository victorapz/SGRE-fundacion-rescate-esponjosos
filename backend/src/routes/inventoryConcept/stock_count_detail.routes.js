"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createStockCountDetail,
  deleteStockCountDetail,
  getStockCountDetail,
  getStockCountDetails,
  updateStockCountDetail,
} from "../../controllers/inventoryConcept/stock_count_detail.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:stock_count_detail:create"),
    createStockCountDetail,
  )
  .get(
    "/",
    checkRbac("inventory:stock_count_detail:read"),
    getStockCountDetails,
  )
  .get(
    "/detail/",
    checkRbac("inventory:stock_count_detail:read"),
    getStockCountDetail,
  )
  .patch(
    "/detail/",
    checkRbac("inventory:stock_count_detail:update"),
    updateStockCountDetail,
  )
  .delete(
    "/detail/",
    checkRbac("inventory:stock_count_detail:delete"),
    deleteStockCountDetail,
  );

export default router;

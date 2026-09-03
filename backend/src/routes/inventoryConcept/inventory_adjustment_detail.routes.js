"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createInventoryAdjustmentDetail,
  deleteInventoryAdjustmentDetail,
  getInventoryAdjustmentDetail,
  getInventoryAdjustmentDetails,
  updateInventoryAdjustmentDetail,
} from "../../controllers/inventoryConcept/inventory_adjustment_detail.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:inventory_adjustment_detail:create"),
    createInventoryAdjustmentDetail,
  )
  .get(
    "/",
    checkRbac("inventory:inventory_adjustment_detail:read"),
    getInventoryAdjustmentDetails,
  )
  .get(
    "/detail/",
    checkRbac("inventory:inventory_adjustment_detail:read"),
    getInventoryAdjustmentDetail,
  )
  .patch(
    "/detail/",
    checkRbac("inventory:inventory_adjustment_detail:update"),
    updateInventoryAdjustmentDetail,
  )
  .delete(
    "/detail/",
    checkRbac("inventory:inventory_adjustment_detail:delete"),
    deleteInventoryAdjustmentDetail,
  );

export default router;

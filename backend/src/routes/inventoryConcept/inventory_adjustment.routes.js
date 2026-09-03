"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  applyInventoryAdjustment,
  createAdjustmentFromStockCount,
  createInventoryAdjustment,
  createManualInventoryAdjustment,
  deleteInventoryAdjustment,
  getInventoryAdjustment,
  getInventoryAdjustments,
  updateInventoryAdjustment,
} from "../../controllers/inventoryConcept/inventory_adjustment.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:inventory_adjustment:create", "inventory:adjustment:create:any"),
    createInventoryAdjustment,
  )
  .post(
    "/manual",
    checkRbac(
      "inventory:inventory_adjustment:create",
      "inventory:adjustment:create:any",
      "inventory:adjustment:create:location",
    ),
    createManualInventoryAdjustment,
  )
  .post(
    "/from_stock_count",
    checkRbac(
      "inventory:inventory_adjustment:create",
      "inventory:adjustment:create:any",
      "inventory:adjustment:create:location",
    ),
    createAdjustmentFromStockCount,
  )
  .post(
    "/apply",
    checkRbac(
      "inventory:inventory_adjustment:update",
      "inventory:adjustment:apply:any",
      "inventory:adjustment:create:location",
    ),
    applyInventoryAdjustment,
  )
  .get(
    "/",
    checkRbac("inventory:inventory_adjustment:read", "inventory:read:location"),
    getInventoryAdjustments,
  )
  .get(
    "/detail/",
    checkRbac("inventory:inventory_adjustment:read", "inventory:read:location"),
    getInventoryAdjustment,
  )
  .patch("/detail/", checkRbac("inventory:inventory_adjustment:update"), updateInventoryAdjustment)
  .delete("/detail/", checkRbac("inventory:inventory_adjustment:delete"), deleteInventoryAdjustment);

export default router;

"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  consumeInventory,
  createInitialInventoryLoad,
  exitInventory,
  getInventoryItemDetail,
  getInventorySummary,
  transferInventory,
} from "../../controllers/inventoryConcept/inventory.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get(
  "/summary",
  checkRbac("inventory:read:any", "inventory:read:location", "inventory:item:read"),
  getInventorySummary,
);
router.get(
  "/item/detail",
  checkRbac("inventory:read:any", "inventory:read:location", "inventory:item:read"),
  getInventoryItemDetail,
);
router.post(
  "/consume",
  checkRbac(
    "inventory:movement:create:any",
    "inventory:movement:create:location",
    "inventory:inventory_movement:create",
  ),
  consumeInventory,
);
router.post(
  "/exit",
  checkRbac(
    "inventory:movement:create:any",
    "inventory:movement:create:location",
    "inventory:inventory_movement:create",
  ),
  exitInventory,
);
router.post(
  "/transfer",
  checkRbac(
    "inventory:movement:create:any",
    "inventory:movement:create:location",
    "inventory:inventory_movement:create",
  ),
  transferInventory,
);
router.post(
  "/initial-load",
  checkRbac("inventory:initial_load:create", "inventory:inventory_movement:create"),
  createInitialInventoryLoad,
);

export default router;

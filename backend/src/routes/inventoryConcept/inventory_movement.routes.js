"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  getInventoryMovement,
  getInventoryMovements,
} from "../../controllers/inventoryConcept/inventory_movement.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .get(
    "/",
    checkRbac("inventory:inventory_movement:read", "inventory:read:any", "inventory:read:location"),
    getInventoryMovements,
  )
  .get(
    "/detail/",
    checkRbac("inventory:inventory_movement:read", "inventory:read:any", "inventory:read:location"),
    getInventoryMovement,
  );

export default router;

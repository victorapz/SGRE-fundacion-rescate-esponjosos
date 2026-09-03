"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  getInventoryExistence,
  getInventoryExistences,
} from "../../controllers/inventoryConcept/inventory_existence.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get(
  "/",
  checkRbac("inventory:read:any", "inventory:read:location", "inventory:inventory_existence:read"),
  getInventoryExistences,
);
router.get(
  "/detail/",
  checkRbac("inventory:read:any", "inventory:read:location", "inventory:inventory_existence:read"),
  getInventoryExistence,
);

export default router;

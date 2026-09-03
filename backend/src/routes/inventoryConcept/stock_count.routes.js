"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createStockCount,
  deleteStockCount,
  getStockCount,
  getStockCounts,
  updateStockCount,
} from "../../controllers/inventoryConcept/stock_count.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:stock_count:create", "inventory:stock_count:create:location"),
    createStockCount,
  )
  .get("/", checkRbac("inventory:stock_count:read", "inventory:read:location"), getStockCounts)
  .get("/detail/", checkRbac("inventory:stock_count:read", "inventory:read:location"), getStockCount)
  .patch("/detail/", checkRbac("inventory:stock_count:update"), updateStockCount)
  .delete("/detail/", checkRbac("inventory:stock_count:delete"), deleteStockCount);

export default router;

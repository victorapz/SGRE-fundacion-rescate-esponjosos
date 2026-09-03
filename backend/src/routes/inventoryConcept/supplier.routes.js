"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  getSuppliers,
  updateSupplier,
} from "../../controllers/inventoryConcept/supplier.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:supplier:create"), createSupplier)
  .get("/", checkRbac("inventory:supplier:read"), getSuppliers)
  .get("/detail/", checkRbac("inventory:supplier:read"), getSupplier)
  .patch("/detail/", checkRbac("inventory:supplier:update"), updateSupplier)
  .delete("/detail/", checkRbac("inventory:supplier:delete"), deleteSupplier);

export default router;

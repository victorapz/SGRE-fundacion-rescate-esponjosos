"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createPurchaseDetail,
  deletePurchaseDetail,
  getPurchaseDetail,
  getPurchaseDetails,
  receivePurchaseDetailsBulk,
  receivePurchaseDetail,
  updatePurchaseDetail,
} from "../../controllers/inventoryConcept/purchase_detail.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:purchase_detail:create"), createPurchaseDetail)
  .post(
    "/receive",
    checkRbac(
      "inventory:purchase_detail:update",
      "inventory:movement:create:any",
      "inventory:movement:create:location",
      "inventory:inventory_movement:create",
    ),
    receivePurchaseDetail,
  )
  .post(
    "/receive-bulk",
    checkRbac(
      "inventory:purchase_detail:update",
      "inventory:movement:create:any",
      "inventory:movement:create:location",
      "inventory:inventory_movement:create",
    ),
    receivePurchaseDetailsBulk,
  )
  .get("/", checkRbac("inventory:purchase_detail:read"), getPurchaseDetails)
  .get("/detail/", checkRbac("inventory:purchase_detail:read"), getPurchaseDetail)
  .patch("/detail/", checkRbac("inventory:purchase_detail:update"), updatePurchaseDetail)
  .delete("/detail/", checkRbac("inventory:purchase_detail:delete"), deletePurchaseDetail);

export default router;

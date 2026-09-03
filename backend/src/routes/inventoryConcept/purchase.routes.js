"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  confirmPurchase,
  createPurchase,
  deletePurchase,
  getPurchase,
  getPurchases,
  revertPurchaseToDraft,
  updatePurchase,
} from "../../controllers/inventoryConcept/purchase.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:purchase:create"), createPurchase)
  .post("/:compra_id/confirm", checkRbac("inventory:purchase:update"), confirmPurchase)
  .post(
    "/:compra_id/revert-draft",
    checkRbac("inventory:purchase:update"),
    revertPurchaseToDraft,
  )
  .get("/", checkRbac("inventory:purchase:read"), getPurchases)
  .get("/detail/", checkRbac("inventory:purchase:read"), getPurchase)
  .patch("/detail/", checkRbac("inventory:purchase:update"), updatePurchase)
  .delete("/detail/", checkRbac("inventory:purchase:delete"), deletePurchase);

export default router;

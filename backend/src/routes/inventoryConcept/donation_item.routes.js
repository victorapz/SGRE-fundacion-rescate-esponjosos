"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createDonationItem,
  deleteDonationItem,
  getDonationItem,
  getDonationItems,
  receiveDonationItemsBulk,
  receiveDonationItem,
  updateDonationItem,
} from "../../controllers/inventoryConcept/donation_item.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:donation_item:create"), createDonationItem)
  .post(
    "/receive",
    checkRbac(
      "inventory:donation_item:update",
      "inventory:movement:create:any",
      "inventory:movement:create:location",
      "inventory:inventory_movement:create",
    ),
    receiveDonationItem,
  )
  .post(
    "/receive-bulk",
    checkRbac(
      "inventory:donation_item:update",
      "inventory:movement:create:any",
      "inventory:movement:create:location",
      "inventory:inventory_movement:create",
    ),
    receiveDonationItemsBulk,
  )
  .get("/", checkRbac("inventory:donation_item:read"), getDonationItems)
  .get("/detail/", checkRbac("inventory:donation_item:read"), getDonationItem)
  .patch("/detail/", checkRbac("inventory:donation_item:update"), updateDonationItem)
  .delete("/detail/", checkRbac("inventory:donation_item:delete"), deleteDonationItem);

export default router;

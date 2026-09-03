"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createDonation,
  deleteDonation,
  getDonation,
  getDonations,
  updateDonation,
} from "../../controllers/inventoryConcept/donation.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:donation:create"), createDonation)
  .get("/", checkRbac("inventory:donation:read"), getDonations)
  .get("/detail/", checkRbac("inventory:donation:read"), getDonation)
  .patch("/detail/", checkRbac("inventory:donation:update"), updateDonation)
  .delete("/detail/", checkRbac("inventory:donation:delete"), deleteDonation);

export default router;

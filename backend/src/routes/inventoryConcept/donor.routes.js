"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createDonor,
  deleteDonor,
  getDonor,
  getDonors,
  updateDonor,
} from "../../controllers/inventoryConcept/donor.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("accounting:donor:create"), createDonor)
  .get("/", checkRbac("accounting:donor:read"), getDonors)
  .get("/detail/", checkRbac("accounting:donor:read"), getDonor)
  .patch("/detail/", checkRbac("accounting:donor:update"), updateDonor)
  .delete("/detail/", checkRbac("accounting:donor:update"), deleteDonor);

export default router;

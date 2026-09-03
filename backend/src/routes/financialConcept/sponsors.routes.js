"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createSponsor,
  getSponsor,
  getSponsors,
  updateSponsor,
} from "../../controllers/financialConcept/sponsorship_admin.controller.js";

const router = Router();

router.use(authenticateJwt);

router.post("/", checkRbac("accounting:sponsor:create"), createSponsor);
router.get("/", checkRbac("accounting:sponsor:read"), getSponsors);
router.get("/:id", checkRbac("accounting:sponsor:read"), getSponsor);
router.patch("/:id", checkRbac("accounting:sponsor:update"), updateSponsor);

export default router;

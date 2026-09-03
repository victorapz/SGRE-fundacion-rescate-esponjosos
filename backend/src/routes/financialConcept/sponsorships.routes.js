"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createManualSponsorship,
  getSponsorship,
  getSponsorships,
} from "../../controllers/financialConcept/sponsorship_admin.controller.js";

const router = Router();

router.use(authenticateJwt);

router.post("/", checkRbac("accounting:sponsorship:create"), createManualSponsorship);
router.get("/", checkRbac("accounting:sponsorship:read"), getSponsorships);
router.get("/:id", checkRbac("accounting:sponsorship:read"), getSponsorship);

export default router;

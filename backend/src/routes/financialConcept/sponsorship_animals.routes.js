"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  getSponsorshipAnimals,
  updateSponsorshipAnimal,
} from "../../controllers/financialConcept/sponsorship_admin.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("accounting:sponsorship:read"), getSponsorshipAnimals);
router.patch("/:id", checkRbac("accounting:sponsorship:update"), updateSponsorshipAnimal);

export default router;

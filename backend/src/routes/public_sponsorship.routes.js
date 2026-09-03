"use strict";

import { Router } from "express";
import {
  getPublicSponsorshipAnimalDetail,
  getPublicSponsorshipAnimals,
  getPublicSponsorshipPlans,
  getPublicSponsorshipStatus,
  startPublicSponsorship,
} from "../controllers/public_sponsorship.controller.js";

const router = Router();

router.get("/plans", getPublicSponsorshipPlans);
router.get("/animals", getPublicSponsorshipAnimals);
router.get("/animals/:id", getPublicSponsorshipAnimalDetail);
router.post("/start", startPublicSponsorship);
router.get("/:publicReference/status", getPublicSponsorshipStatus);

export default router;

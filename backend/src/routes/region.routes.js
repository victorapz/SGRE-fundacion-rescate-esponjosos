"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import {
  createRegion,
  getRegion,
  getRegions,
  toggleRegionActive,
  updateRegion,
} from "../controllers/region.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", getRegions);
router.get("/:id", getRegion);
router.post(
  "/",
  checkRbac("configuration:region:create"),
  createRegion,
);
router.patch(
  "/:id",
  checkRbac("configuration:region:update"),
  updateRegion,
);
router.patch(
  "/:id/toggle-active",
  checkRbac("configuration:region:deactivate"),
  toggleRegionActive,
);

export default router;

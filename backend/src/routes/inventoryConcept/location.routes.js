"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createLocation,
  deleteLocation,
  getLocation,
  getLocations,
  updateLocation,
} from "../../controllers/inventoryConcept/location.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("inventory:location:create"), createLocation)
  .get("/", checkRbac("inventory:location:read"), getLocations)
  .get("/detail/", checkRbac("inventory:location:read"), getLocation)
  .patch("/detail/", checkRbac("inventory:location:update"), updateLocation)
  .delete("/detail/", checkRbac("inventory:location:delete"), deleteLocation);

export default router;

"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import {
  createComuna,
  getComuna,
  getComunas,
  toggleComunaActive,
  updateComuna,
} from "../controllers/comuna.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", getComunas);
// Compatibilidad con consumidores legacy.
router.get("/detail/", getComuna);
router.post(
  "/",
  checkRbac("configuration:commune:create"),
  createComuna,
);
router.patch(
  "/:id",
  checkRbac("configuration:commune:update"),
  updateComuna,
);
router.patch(
  "/:id/toggle-active",
  checkRbac("configuration:commune:deactivate"),
  toggleComunaActive,
);
router.get("/:id", getComuna);
router.patch(
  "/detail/",
  checkRbac("configuration:commune:update"),
  updateComuna,
);
router.delete(
  "/detail/",
  checkRbac("configuration:commune:deactivate"),
  toggleComunaActive,
);

export default router;

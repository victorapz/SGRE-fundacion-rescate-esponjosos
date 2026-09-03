"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import {
  createArea,
  getArea,
  getAreas,
  getAreaUsage,
  toggleAreaActive,
  updateArea,
} from "../controllers/area.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get(
  "/",
  checkRbac(
    "configuration:area:read",
    "users:user:read",
    "users:user_area:assign",
    "home:task:create:any",
    "home:task:create:area",
    "home:task:assign:any",
    "home:task:assign:area",
  ),
  getAreas,
);
router.get(
  "/:id",
  checkRbac("configuration:area:read", "users:user:read", "users:user_area:assign"),
  getArea,
);
router.get(
  "/:id/usage",
  checkRbac("configuration:area:read", "configuration:area:update"),
  getAreaUsage,
);
router.post(
  "/",
  checkRbac("configuration:area:create"),
  createArea,
);
router.patch(
  "/:id",
  checkRbac("configuration:area:update"),
  updateArea,
);
router.patch(
  "/:id/toggle-active",
  checkRbac("configuration:area:deactivate"),
  toggleAreaActive,
);

export default router;

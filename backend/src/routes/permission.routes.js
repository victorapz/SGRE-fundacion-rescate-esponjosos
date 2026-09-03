"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { getPermissions } from "../controllers/permission.controller.js";

const router = Router();

router.use(authenticateJwt);

router.get("/", checkRbac("role:read"), getPermissions);

export default router;

"use strict";

import { Router } from "express";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import {
	createRole,
	deleteRole,
	getRole,
	getRoles,
	updateRole,
} from "../controllers/role.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.post("/create", checkRbac("role:create"), createRole)
	.get("/", checkRbac("role:read", "users:user_role:assign"), getRoles)
	.get("/detail/", checkRbac("role:read", "users:user_role:assign"), getRole)
	.patch("/detail/", checkRbac("role:update"), updateRole)
	.delete("/detail/", checkRbac("role:delete"), deleteRole);

export default router;

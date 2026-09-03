"use strict";
import { Router } from "express";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import {
	createShift,
	deleteShift,
	getShift,
	getShifts,
	updateShift,
} from "../controllers/shift.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.post("/create", checkRbac("home:shift:create"), createShift)
	.get("/", checkRbac("home:shift:read"), getShifts)
	.get("/detail/", checkRbac("home:shift:read"), getShift)
	.patch("/detail/", checkRbac("home:shift:update"), updateShift)
	.delete("/detail/", checkRbac("home:shift:delete"), deleteShift);

export default router;

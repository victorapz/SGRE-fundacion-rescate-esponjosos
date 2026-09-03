"use strict";

import { Router } from "express";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import {
	archiveTask,
	createTask,
	createTaskComment,
	deleteTask,
	getTask,
	getTaskComments,
	getTaskHistory,
	getTaskModuleAccess,
	getTasks,
	updateTask,
	updateTaskAssignmentStatus,
} from "../controllers/task.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.get(
		"/access",
		checkRbac(
			"home:task:read:any",
			"home:task:read:area",
			"home:task:read:mine",
			"home:task:create:any",
			"home:task:create:area",
			"home:task:update:any",
			"home:task:update:area",
			"home:task:update:status:mine",
			"home:task:assign:any",
			"home:task:assign:area",
			"home:task:history:read:any",
			"home:task:history:read:area",
			"home:task:history:read:mine",
			"home:task:comment:any",
			"home:task:comment:area",
			"home:task:comment:mine",
		),
		getTaskModuleAccess,
	)
	.post(
		"/create",
		checkRbac("home:task:create:any", "home:task:create:area"),
		createTask,
	)
	.get(
		"/",
		checkRbac("home:task:read:any", "home:task:read:area", "home:task:read:mine"),
		getTasks,
	)
	.get(
		"/detail",
		checkRbac("home:task:read:any", "home:task:read:area", "home:task:read:mine"),
		getTask,
	)
	.patch(
		"/detail",
		checkRbac("home:task:update:any", "home:task:update:area"),
		updateTask,
	)
	.patch(
		"/detail/archive",
		checkRbac("home:task:update:any", "home:task:update:area"),
		archiveTask,
	)
	.delete(
		"/detail",
		checkRbac("home:task:delete:any", "home:task:delete:area", "home:task:delete:mine"),
		deleteTask,
	)
	.patch(
		"/assignment/status",
		checkRbac(
			"home:task:update:any",
			"home:task:update:area",
			"home:task:update:status:mine",
		),
		updateTaskAssignmentStatus,
	)
	.post(
		"/comments",
		checkRbac(
			"home:task:comment:any",
			"home:task:comment:area",
			"home:task:comment:mine",
		),
		createTaskComment,
	)
	.get(
		"/comments",
		checkRbac(
			"home:task:read:any",
			"home:task:read:area",
			"home:task:read:mine",
			"home:task:comment:any",
			"home:task:comment:area",
			"home:task:comment:mine",
		),
		getTaskComments,
	)
	.get(
		"/history",
		checkRbac(
			"home:task:history:read:any",
			"home:task:history:read:area",
			"home:task:history:read:mine",
		),
		getTaskHistory,
	);

export default router;

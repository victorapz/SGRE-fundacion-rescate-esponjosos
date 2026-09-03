"use strict";
import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import {
  requireUserCreateAssignmentPermissions,
  requireUserUpdateAssignmentPermissions,
} from "../middlewares/user-authorization.middleware.js";
import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  resetUserPassword,
  updateUser,
} from "../controllers/user.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("users:user:create"),
    requireUserCreateAssignmentPermissions,
    createUser,
  )
  .patch(
    "/:id/password",
    checkRbac("users:user_password:reset"),
    resetUserPassword,
  )
  .get("/", checkRbac("users:user:read"), getUsers)
  .get("/detail/", checkRbac("users:user:read", "users:user:update"), getUser)
  .patch(
    "/detail/",
    checkRbac("users:user:update"),
    requireUserUpdateAssignmentPermissions,
    updateUser,
  )
  .delete("/detail/", checkRbac("users:user:delete"), deleteUser);

export default router;

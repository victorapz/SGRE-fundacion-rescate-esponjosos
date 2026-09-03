"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createFosterAssignment,
  deleteFosterAssignment,
  getFosterAssignment,
  getFosterAssignments,
  updateFosterAssignment,
} from "../../controllers/animalConcept/foster_assignment.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("animals:foster_assignment:create"),
    createFosterAssignment,
  )
  .get(
    "/",
    checkRbac("animals:foster_assignment:read"),
    getFosterAssignments,
  )
  .get(
    "/detail/",
    checkRbac("animals:foster_assignment:read"),
    getFosterAssignment,
  )
  .patch(
    "/detail/",
    checkRbac("animals:foster_assignment:update"),
    updateFosterAssignment,
  )
  .delete(
    "/detail/",
    checkRbac("animals:foster_assignment:delete"),
    deleteFosterAssignment,
  );

export default router;

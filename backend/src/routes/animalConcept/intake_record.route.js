"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createIntakeRecord,
  deleteIntakeRecord,
  getIntakeRecord,
  getIntakeRecords,
  updateIntakeRecord,
} from "../../controllers/animalConcept/intake_record.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:intake_record:create"), createIntakeRecord)
  .get("/", checkRbac("animals:intake_record:read"), getIntakeRecords)
  .get("/detail/", checkRbac("animals:intake_record:read"), getIntakeRecord)
  .patch(
    "/detail/",
    checkRbac("animals:intake_record:update"),
    updateIntakeRecord,
  )
  .delete(
    "/detail/",
    checkRbac("animals:intake_record:delete"),
    deleteIntakeRecord,
  );

export default router;

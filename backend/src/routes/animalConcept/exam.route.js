"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createExam,
  deleteExam,
  getExam,
  getExams,
  updateExam,
} from "../../controllers/animalConcept/exam.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:exam:create"), createExam)
  .get("/", checkRbac("animals:exam:read"), getExams)
  .get("/detail/", checkRbac("animals:exam:read"), getExam)
  .patch("/detail/", checkRbac("animals:exam:update"), updateExam)
  .delete("/detail/", checkRbac("animals:exam:delete"), deleteExam);

export default router;

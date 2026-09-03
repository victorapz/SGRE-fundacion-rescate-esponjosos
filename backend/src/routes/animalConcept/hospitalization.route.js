"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createHospitalization,
  deleteHospitalization,
  getHospitalization,
  getHospitalizations,
  updateHospitalization,
} from "../../controllers/animalConcept/hospitalization.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("animals:hospitalization:create"),
    createHospitalization,
  )
  .get(
    "/",
    checkRbac("animals:hospitalization:read"),
    getHospitalizations,
  )
  .get(
    "/detail/",
    checkRbac("animals:hospitalization:read"),
    getHospitalization,
  )
  .patch(
    "/detail/",
    checkRbac("animals:hospitalization:update"),
    updateHospitalization,
  )
  .delete(
    "/detail/",
    checkRbac("animals:hospitalization:delete"),
    deleteHospitalization,
  );

export default router;

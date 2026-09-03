"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createFosterHomeObservation,
  deleteFosterHomeObservation,
  getFosterHomeObservations,
} from "../../controllers/animalConcept/foster_home_observation.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:foster_home:update"), createFosterHomeObservation)
  .get("/", checkRbac("animals:foster_home_observation:read"), getFosterHomeObservations)
  .delete(
    "/detail/",
    checkRbac("animals:foster_home:update", "animals:foster_home:delete"),
    deleteFosterHomeObservation,
  );

export default router;

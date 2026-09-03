"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createFosterHome,
  deleteFosterHome,
  getEligibleAnimalsForFosterHome,
  getFosterHome,
  getFosterHomes,
  getMyFosterHome,
  updateFosterHome,
} from "../../controllers/animalConcept/foster_home.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:foster_home:create"), createFosterHome)
  .get("/", checkRbac("animals:foster_home:read"), getFosterHomes)
  .get("/my-home/", checkRbac("animals:foster_home:read"), getMyFosterHome)
  .get(
    "/eligible_animals/",
    checkRbac("animals:foster_home:read", "animals:foster_assignment:create"),
    getEligibleAnimalsForFosterHome,
  )
  .get("/detail/", checkRbac("animals:foster_home:read"), getFosterHome)
  .patch(
    "/detail/",
    checkRbac("animals:foster_home:update"),
    updateFosterHome,
  )
  .delete(
    "/detail/",
    checkRbac("animals:foster_home:delete"),
    deleteFosterHome,
  );

export default router;

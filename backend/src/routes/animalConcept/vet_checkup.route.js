"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createVetCheckup,
  deleteVetCheckup,
  getVetCheckup,
  getVetCheckups,
  updateVetCheckup,
} from "../../controllers/animalConcept/vet_checkup.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:vet_checkup:create"), createVetCheckup)
  .get("/", checkRbac("animals:vet_checkup:read"), getVetCheckups)
  .get("/detail/", checkRbac("animals:vet_checkup:read"), getVetCheckup)
  .patch(
    "/detail/",
    checkRbac("animals:vet_checkup:update"),
    updateVetCheckup,
  )
  .delete(
    "/detail/",
    checkRbac("animals:vet_checkup:delete"),
    deleteVetCheckup,
  );

export default router;

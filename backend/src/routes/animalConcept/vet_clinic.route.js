"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createVetClinic,
  deleteVetClinic,
  getVetClinic,
  getVetClinics,
  updateVetClinic,
} from "../../controllers/animalConcept/vet_clinic.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:vet_clinic:create"), createVetClinic)
  .get("/", checkRbac("animals:vet_clinic:read"), getVetClinics)
  .get("/detail/", checkRbac("animals:vet_clinic:read"), getVetClinic)
  .patch(
    "/detail/",
    checkRbac("animals:vet_clinic:update"),
    updateVetClinic,
  )
  .delete(
    "/detail/",
    checkRbac("animals:vet_clinic:delete"),
    deleteVetClinic,
  );

export default router;

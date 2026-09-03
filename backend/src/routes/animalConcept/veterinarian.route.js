"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createVeterinarian,
  deleteVeterinarian,
  getVeterinarian,
  getVeterinarians,
  updateVeterinarian,
} from "../../controllers/animalConcept/veterinarian.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:veterinarian:create"), createVeterinarian)
  .get("/", checkRbac("animals:veterinarian:read"), getVeterinarians)
  .get("/detail/", checkRbac("animals:veterinarian:read"), getVeterinarian)
  .patch(
    "/detail/",
    checkRbac("animals:veterinarian:update"),
    updateVeterinarian,
  )
  .delete(
    "/detail/",
    checkRbac("animals:veterinarian:delete"),
    deleteVeterinarian,
  );

export default router;

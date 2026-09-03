"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createFosterHomeAllowedAnimal,
  deleteFosterHomeAllowedAnimal,
  getFosterHomeAllowedAnimal,
  getFosterHomeAllowedAnimals,
  updateFosterHomeAllowedAnimal,
} from "../../controllers/animalConcept/foster_home_allowed_animal.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("animals:foster_home:update"),
    createFosterHomeAllowedAnimal,
  )
  .get(
    "/",
    checkRbac("animals:foster_home:read"),
    getFosterHomeAllowedAnimals,
  )
  .get(
    "/detail/",
    checkRbac("animals:foster_home:read"),
    getFosterHomeAllowedAnimal,
  )
  .patch(
    "/detail/",
    checkRbac("animals:foster_home:update"),
    updateFosterHomeAllowedAnimal,
  )
  .delete(
    "/detail/",
    checkRbac("animals:foster_home:delete"),
    deleteFosterHomeAllowedAnimal,
  );

export default router;

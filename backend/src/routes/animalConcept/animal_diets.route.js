"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
	createAnimalDiet,
	deleteAnimalDiet,
	getAnimalDiet,
	getAnimalDiets,
	updateAnimalDiet,
} from "../../controllers/animalConcept/animal_diets.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.post("/create", checkRbac("animals:animal_diets:create"), createAnimalDiet)
	.get("/", checkRbac("animals:animal_diets:read"), getAnimalDiets)
	.get("/detail/", checkRbac("animals:animal_diets:read"), getAnimalDiet)
	.patch(
		"/detail/",
		checkRbac("animals:animal_diets:update"),
		updateAnimalDiet,
	)
	.delete(
		"/detail/",
		checkRbac("animals:animal_diets:delete"),
		deleteAnimalDiet,
	);

export default router;

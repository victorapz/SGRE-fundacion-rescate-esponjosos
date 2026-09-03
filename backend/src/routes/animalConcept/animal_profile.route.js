"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
	createAnimalProfile,
	deleteAnimalProfile,
	getAnimalProfile,
	getAnimalProfiles,
	updateAnimalProfile,
} from "../../controllers/animalConcept/animal_profile.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.post(
		"/create",
		checkRbac("animals:animal_profile:create"),
		createAnimalProfile,
	)
	.get("/", checkRbac("animals:animal_profile:read"), getAnimalProfiles)
	.get(
		"/detail/",
		checkRbac("animals:animal_profile:read"),
		getAnimalProfile,
	)
	.patch(
		"/detail/",
		checkRbac("animals:animal_profile:update"),
		updateAnimalProfile,
	)
	.delete(
		"/detail/",
		checkRbac("animals:animal_profile:delete"),
		deleteAnimalProfile,
	);

export default router;

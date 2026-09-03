"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
	createAnimal,
	deleteAnimal,
	getAnimal,
	getAnimals,
	updateAnimal,
} from "../../controllers/animalConcept/animal.controller.js";

const router = Router();

router.use(authenticateJwt);

router
	.post("/create", checkRbac("animals:animal:create"), createAnimal)
	.get("/", checkRbac("animals:animal:read"), getAnimals)
	.get("/detail/", checkRbac("animals:animal:read"), getAnimal)
	.patch("/detail/", checkRbac("animals:animal:update"), updateAnimal)
	.delete("/detail/", checkRbac("animals:animal:delete"), deleteAnimal);

export default router;

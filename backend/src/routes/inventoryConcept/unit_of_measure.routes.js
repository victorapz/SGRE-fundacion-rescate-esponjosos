"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";

import {
  createUnitOfMeasure,
  deleteUnitOfMeasure,
  getUnitOfMeasure,
  getUnitsOfMeasure,
  updateUnitOfMeasure,
} from "../../controllers/inventoryConcept/unit_of_measure.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/create",
    checkRbac("inventory:unit_of_measure:create"),
    createUnitOfMeasure,
  )
  .get(
    "/",
    checkRbac("inventory:unit_of_measure:read"),
    getUnitsOfMeasure,
  )
  .get(
    "/detail/",
    checkRbac("inventory:unit_of_measure:read"),
    getUnitOfMeasure,
  )
  .patch(
    "/detail/",
    checkRbac("inventory:unit_of_measure:update"),
    updateUnitOfMeasure,
  )
  .delete(
    "/detail/",
    checkRbac("inventory:unit_of_measure:delete"),
    deleteUnitOfMeasure,
  );

export default router;

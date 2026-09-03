"use strict";

import { Router } from "express";
import { authenticateJwt } from "../../middlewares/authentication.middleware.js";
import { checkRbac } from "../../middlewares/rbac.middleware.js";
import {
  createProcedure,
  deleteProcedure,
  getProcedure,
  getProcedures,
  updateProcedure,
} from "../../controllers/animalConcept/procedure.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("animals:procedure:create"), createProcedure)
  .get("/", checkRbac("animals:procedure:read"), getProcedures)
  .get("/detail/", checkRbac("animals:procedure:read"), getProcedure)
  .patch(
    "/detail/",
    checkRbac("animals:procedure:update"),
    updateProcedure,
  )
  .delete(
    "/detail/",
    checkRbac("animals:procedure:delete"),
    deleteProcedure,
  );

export default router;

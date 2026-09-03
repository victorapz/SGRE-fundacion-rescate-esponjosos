"use strict";
import { Router } from "express";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import {
  createEvent,
  deleteEvent,
  getEvent,
  getEvents,
  updateEvent,
} from "../controllers/event.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post("/create", checkRbac("home:event:create"), createEvent)
  .get("/", checkRbac("home:event:read"), getEvents)
  .get("/detail/", checkRbac("home:event:read"), getEvent)
  .patch("/detail/", checkRbac("home:event:update"), updateEvent)
  .delete("/detail/", checkRbac("home:event:delete"), deleteEvent)

export default router;

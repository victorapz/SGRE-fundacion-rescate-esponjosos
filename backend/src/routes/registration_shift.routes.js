"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";

import {
  cancelRegistration,
  getShiftRegistrations,
  getUserHistoryRegistrations,
  getUserUpcomingRegistrations,
  getUserRegistrations,
  markAttendance,
  registerUserInShift,
  saveRegistrationBitacora,
  updateRegistrationStatus,
} from "../controllers/registration_shift.controller.js";

const router = Router();

router.use(authenticateJwt);

router
  .post(
    "/:shiftId/register/:userId",
    checkRbac("home:shift:register"),
    registerUserInShift,
  )
  .delete(
    "/:shiftId/register/:userId",
    checkRbac("home:shift:cancel"),
    cancelRegistration,
  )
  .get(
    "/:shiftId/registrations",
    checkRbac("home:shift:registrations:read"),
    getShiftRegistrations,
  )
  .get(
    "/registrations/user/:userId",
    checkRbac(
      "home:shift:registrations:self:read",
      "home:shift:registrations:read",
    ),
    getUserRegistrations,
  )
  .get(
    "/registrations/user/:userId/upcoming",
    checkRbac(
      "home:shift:registrations:self:read",
      "home:shift:registrations:read",
    ),
    getUserUpcomingRegistrations,
  )
  .get(
    "/registrations/user/:userId/history",
    checkRbac(
      "home:shift:registrations:self:read",
      "home:shift:registrations:read",
    ),
    getUserHistoryRegistrations,
  )
  .patch(
    "/registrations/:registrationId",
    checkRbac("home:shift:update"),
    updateRegistrationStatus,
  )
  .patch(
    "/registrations/:registrationId/bitacora",
    checkRbac("home:shift:register"),
    saveRegistrationBitacora,
  )
  .patch(
    "/registrations/:registrationId/attendance",
    checkRbac("home:shift:register"),
    markAttendance,
  );

export default router;

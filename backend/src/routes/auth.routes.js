"use strict";

import { Router } from "express";
import {
  changeMyPassword,
  getMe,
  getMyProfile,
  login,
  logout,
  refresh,
  updateMyProfile,
} from "../controllers/auth.controller.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);

router.use(authenticateJwt);
router.get("/me", getMe);
router.get("/me/profile", getMyProfile);
router.patch("/me/profile", updateMyProfile);
router.patch("/me/password", changeMyPassword);

export default router;

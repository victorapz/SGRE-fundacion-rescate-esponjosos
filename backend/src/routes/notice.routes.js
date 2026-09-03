"use strict";

import { Router } from "express";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { uploadSingleImage } from "../middlewares/multer.middleware.js";
import {
  createNotice,
  deleteNotice,
  deleteNoticeCover,
  getNotice,
  getNoticeAssets,
  getNotices,
  previewNoticeAsset,
  updateNotice,
  uploadNoticeContentImage,
  uploadNoticeCover,
} from "../controllers/notice.controller.js";
import { handleErrorClient } from "../handlers/responseHandlers.js";

const router = Router();
const imageUploadMiddleware = uploadSingleImage("file");

function handleImageUpload(req, res, next) {
  imageUploadMiddleware(req, res, (error) => {
    if (error) {
      return handleErrorClient(res, 400, "Error de carga de archivo", error.message);
    }

    return next();
  });
}

router.use(authenticateJwt);

router.post("/create", checkRbac("home:notice:create"), createNotice);
router.get("/", checkRbac("home:notice:read"), getNotices);
router.get("/detail", checkRbac("home:notice:read"), getNotice);
router.patch("/detail", checkRbac("home:notice:update"), updateNotice);
router.delete("/detail", checkRbac("home:notice:delete"), deleteNotice);
router.get("/detail/assets", checkRbac("home:notice:read"), getNoticeAssets);
router.post(
  "/detail/cover",
  checkRbac("home:notice:create", "home:notice:update"),
  handleImageUpload,
  uploadNoticeCover,
);
router.delete(
  "/detail/cover",
  checkRbac("home:notice:update"),
  deleteNoticeCover,
);
router.post(
  "/detail/content-images",
  checkRbac("home:notice:create", "home:notice:update"),
  handleImageUpload,
  uploadNoticeContentImage,
);
router.get("/assets/:assetUuid/preview", checkRbac("home:notice:read"), previewNoticeAsset);

export default router;

"use strict";

import { Router } from "express";
import { authenticateJwt } from "../middlewares/authentication.middleware.js";
import { checkRbac } from "../middlewares/rbac.middleware.js";
import { uploadSingleDocument } from "../middlewares/multer.middleware.js";
import {
  deleteFileAsset,
  downloadFileAsset,
  getFileAssets,
  markFileAssetAsMain,
  previewFileAsset,
  uploadFileAsset,
} from "../controllers/file_asset.controller.js";
import { handleErrorClient } from "../handlers/responseHandlers.js";

const router = Router();
const fileUploadMiddleware = uploadSingleDocument("file");

function handleFileUpload(req, res, next) {
  fileUploadMiddleware(req, res, (error) => {
    if (error) {
      return handleErrorClient(res, 400, "Error de carga de archivo", error.message);
    }

    return next();
  });
}

router.use(authenticateJwt);

router.post(
  "/",
  checkRbac(
    "files:file:upload",
    "files:animal:upload",
    "files:animal_clinical:upload",
    "files:user_document:upload",
    "files:accounting:upload",
  ),
  handleFileUpload,
  uploadFileAsset,
);

router.get(
  "/",
  checkRbac(
    "files:file:read",
    "files:animal:read",
    "files:animal_clinical:read",
    "files:user_document:read",
    "files:accounting:read",
  ),
  getFileAssets,
);

router.get(
  "/:id/preview",
  checkRbac(
    "files:file:read",
    "files:animal:read",
    "files:animal_clinical:read",
    "files:user_document:read",
    "files:accounting:read",
  ),
  previewFileAsset,
);

router.get(
  "/:id/download",
  checkRbac(
    "files:file:download",
    "files:file:read",
    "files:animal:read",
    "files:animal_clinical:read",
    "files:user_document:read",
    "files:accounting:read",
  ),
  downloadFileAsset,
);

router.patch(
  "/:id/main",
  checkRbac("files:file:update", "files:animal:upload"),
  markFileAssetAsMain,
);

router.delete(
  "/:id",
  checkRbac(
    "files:file:delete",
    "files:animal:delete",
    "files:animal_clinical:delete",
    "files:user_document:delete",
    "files:accounting:delete",
  ),
  deleteFileAsset,
);

export default router;

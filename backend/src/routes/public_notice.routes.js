"use strict";

import { Router } from "express";
import {
  getPublicNoticeAsset,
  getPublicNoticeBySlug,
  getPublicNotices,
} from "../controllers/public_notice.controller.js";

const router = Router();

router.get("/", getPublicNotices);
router.get("/:slug", getPublicNoticeBySlug);
router.get("/:slug/assets/:assetUuid", getPublicNoticeAsset);

export default router;

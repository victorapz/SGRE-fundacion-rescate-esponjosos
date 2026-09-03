"use strict";

import { Router } from "express";
import { getPublicAnimalFilePreview } from "../controllers/public_file_asset.controller.js";

const router = Router();

router.get("/:publicId/preview", getPublicAnimalFilePreview);

export default router;

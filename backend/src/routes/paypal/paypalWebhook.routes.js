"use strict";

import { Router } from "express";
import { receivePayPalWebhook } from "../../controllers/paypal/paypalWebhook.controller.js";

const router = Router();

router.post("/", receivePayPalWebhook);

export default router;

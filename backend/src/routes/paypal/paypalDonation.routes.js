"use strict";

import { Router } from "express";
import {
  capturePayPalDonationOrder,
  createPayPalDonationOrder,
} from "../../controllers/paypal/paypalDonation.controller.js";

const router = Router();

router.post("/create-order", createPayPalDonationOrder);
router.post("/capture-order", capturePayPalDonationOrder);

export default router;

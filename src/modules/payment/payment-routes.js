import { Router } from "express";

import { requireAuth } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import asyncHandler from "../../utils/async-handler.js";

import { createBookingPayment } from "./payment-controller.js";
import { handlePaymobWebhook } from "./webhook-controller.js";

import { initiatePaymentValidator } from "./payment-validator.js";

const router = Router();

router.post(
  "/bookings/:bookingId/payments",
  requireAuth,
  validate(initiatePaymentValidator),
  asyncHandler(createBookingPayment),
);

router.post("/payments/paymob/webhook", asyncHandler(handlePaymobWebhook));

export default router;

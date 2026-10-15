import { initiateBookingPayment } from "./payment-service.js";
import asyncHandler from "../../utils/async-handler.js";

export const createBookingPayment = asyncHandler(async (req, res) => {
  const result = await initiateBookingPayment({
    userId: req.auth.userId,
    bookingId: req.params.bookingId,
    idempotencyKey: req.get("Idempotency-Key"),
    billingData: req.body.billingData,
  });

  return res.status(200).json({
    success: true,
    message: "Payment initiation processed",
    data: result,
  });
});

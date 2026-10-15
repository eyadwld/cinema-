import asyncHandler from "../../utils/async-handler.js";
import * as paymentService from "./payment-service.js";

export const initiate = asyncHandler(async (req, res) => {
  const result = await paymentService.initiatePayment({
    bookingId: req.params.bookingId,
    userId: req.auth.userId,
    idempotencyKey: req.get("Idempotency-Key"),
  });

  res.status(result.reused ? 200 : 201).json({
    success: true,
    message: result.reused ? "Payment already initiated" : "Payment initiated. Complete checkout to confirm.",
    data: result,
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const result = await paymentService.getPaymentById({
    paymentId: req.params.paymentId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const webhook = asyncHandler(async (req, res) => {
  const result = await paymentService.handlePaymobWebhook({
    hmac: req.query.hmac,
    body: req.body,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

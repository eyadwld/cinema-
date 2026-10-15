import { header, param } from "express-validator";

export const initiatePaymentValidator = [
  param("bookingId").isMongoId().withMessage("Invalid booking ID"),
  header("Idempotency-Key").notEmpty().withMessage("Idempotency-Key header is required"),
];

export const getPaymentValidator = [param("paymentId").isMongoId().withMessage("Invalid payment ID")];

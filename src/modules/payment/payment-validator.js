import { body, header, param } from "express-validator";

export const initiatePaymentValidator = [
  param("bookingId").isMongoId().withMessage("Invalid booking ID"),

  header("Idempotency-Key")
    .notEmpty()
    .withMessage("Idempotency-Key header is required")
    .isLength({ min: 1, max: 128 })
    .withMessage("Idempotency-Key must be between 1 and 128 characters"),

  body("billingData").optional().isObject().withMessage("Invalid billing data"),
];

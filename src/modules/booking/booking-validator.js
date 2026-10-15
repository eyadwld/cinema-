import { body, param, query } from "express-validator";

export const createBookingValidator = [
  param("showtimeId").isMongoId().withMessage("Invalid showtime ID"),

  body("seatIds")
    .isArray({ min: 1, max: 10 })
    .withMessage("Choose between 1 and 10 seats"),

  body("seatIds.*").isMongoId().withMessage("Invalid seat ID"),

  body("lockToken")
    .notEmpty()
    .withMessage("Lock token is required")
    .isUUID()
    .withMessage("Invalid lock token"),
];

export const listBookingsValidator = [
  query("status")
    .optional()
    .isIn(["PENDING_PAYMENT", "CONFIRMED", "EXPIRED", "CANCELLED"])
    .withMessage("Invalid booking status"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

export const bookingIdValidator = [
  param("bookingId").isMongoId().withMessage("Invalid booking ID"),
];

export const bookingShowtimeIdValidator = [
  param("showtimeId").isMongoId().withMessage("Invalid showtime ID"),
];

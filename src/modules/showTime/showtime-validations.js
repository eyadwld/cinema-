import { body, param, query } from "express-validator";

export const createShowtimeValidator = [
  body("movieId")
    .notEmpty()
    .withMessage("Movie ID is required")
    .isMongoId()
    .withMessage("Invalid movie ID"),

  body("screenId")
    .notEmpty()
    .withMessage("Screen ID is required")
    .isMongoId()
    .withMessage("Invalid screen ID"),

  body("startsAt")
    .notEmpty()
    .withMessage("Start time is required")
    .isISO8601()
    .withMessage("Invalid start time"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),
];

export const updateShowtimeValidator = [
  body("startsAt")
    .optional()
    .isISO8601()
    .withMessage("Invalid start time"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const showtimeIdValidator = [
  param("id").isMongoId().withMessage("Invalid showtime ID"),
];

export const listShowtimesValidator = [
  query("movieId").optional().isMongoId().withMessage("Invalid movie ID"),

  query("screenId").optional().isMongoId().withMessage("Invalid screen ID"),

  query("cinemaId").optional().isMongoId().withMessage("Invalid cinema ID"),

  query("from").optional().isISO8601().withMessage("Invalid from date"),

  query("to").optional().isISO8601().withMessage("Invalid to date"),
];

export const lockSeatsValidator = [
  param("id").isMongoId().withMessage("Invalid showtime ID"),

  body("seatIds")
    .isArray({ min: 1, max: 10 })
    .withMessage("Choose between 1 and 10 seats"),

  body("seatIds.*").isMongoId().withMessage("Invalid seat ID"),
];

export const unlockSeatsValidator = [
  param("id").isMongoId().withMessage("Invalid showtime ID"),

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

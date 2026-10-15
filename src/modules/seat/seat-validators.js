import { body, param } from "express-validator";

export const seatScreenIdValidator = [
  param("screenId").isMongoId().withMessage("Invalid screen ID"),
];

export const seatIdValidator = [
  param("id").isMongoId().withMessage("Invalid seat ID"),
];

export const updateSeatValidator = [
  body("type")
    .optional()
    .isIn(["STANDARD", "PREMIUM", "VIP"])
    .withMessage("Invalid seat type"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

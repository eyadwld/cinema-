import { body, param } from "express-validator";

export const createCinemaValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 150 })
    .withMessage("Name must be between 2 and 150 characters"),

  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City must be at most 100 characters"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Address is required")
    .isLength({ max: 300 })
    .withMessage("Address must be at most 300 characters"),
];

export const updateCinemaValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Name must be between 2 and 150 characters"),

  body("city")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("City must be at most 100 characters"),

  body("address")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Address must be at most 300 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const cinemaIdValidator = [
  param("id").isMongoId().withMessage("Invalid cinema ID"),
];

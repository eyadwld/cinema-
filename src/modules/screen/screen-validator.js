import { body, param } from "express-validator";

export const createScreenValidator = [
  body("cinemaId")
    .notEmpty()
    .withMessage("Cinema ID is required")
    .isMongoId()
    .withMessage("Invalid cinema ID"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),

  body("rows")
    .notEmpty()
    .withMessage("Rows is required")
    .isInt({ min: 1, max: 100 })
    .withMessage("Rows must be between 1 and 100"),

  body("columns")
    .notEmpty()
    .withMessage("Columns is required")
    .isInt({ min: 1, max: 100 })
    .withMessage("Columns must be between 1 and 100"),

  body("generateSeats")
    .optional()
    .isBoolean()
    .withMessage("generateSeats must be a boolean"),
];

export const updateScreenValidator = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),

  body("rows")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Rows must be between 1 and 100"),

  body("columns")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Columns must be between 1 and 100"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const screenIdValidator = [
  param("id").isMongoId().withMessage("Invalid screen ID"),
];

export const cinemaIdParamValidator = [
  param("cinemaId").isMongoId().withMessage("Invalid cinema ID"),
];

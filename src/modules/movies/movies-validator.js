import { body, param } from "express-validator";

export const createMovieValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description must be at most 5000 characters"),

  body("durationMinutes")
    .notEmpty()
    .withMessage("Duration is required")
    .isInt({ min: 1, max: 600 })
    .withMessage("Duration must be between 1 and 600 minutes"),

  body("genre")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string")
    .withMessage("Genre must be an array"),

  body("genre")
    .optional()
    .if((value) => typeof value === "string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Genre must be between 1 and 50 characters"),

  body("genre.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Genre must be between 1 and 50 characters"),

  body("language")
    .trim()
    .notEmpty()
    .withMessage("Language is required")
    .isLength({ max: 50 })
    .withMessage("Language must be at most 50 characters"),

  body("ageRating")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Age rating must be at most 20 characters"),

  body("posterUrl")
    .optional()
    .custom(
      (value) =>
        typeof value === "string" ||
        (value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof value.url === "string"),
    )
    .withMessage("Invalid poster URL"),

  body("posterUrl")
    .optional()
    .if((value) => typeof value === "string")
    .trim()
    .isURL()
    .withMessage("Invalid poster URL"),

  body("posterUrl.url")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid poster URL"),

  body("posterUrl.publicId")
    .optional()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage("Invalid poster URL"),

  body("releaseDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid release date"),
];

export const updateMovieValidator = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description must be at most 5000 characters"),

  body("durationMinutes")
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage("Duration must be between 1 and 600 minutes"),

  body("genre")
    .optional()
    .custom((value) => Array.isArray(value) || typeof value === "string")
    .withMessage("Genre must be an array"),

  body("genre")
    .optional()
    .if((value) => typeof value === "string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Genre must be between 1 and 50 characters"),

  body("genre.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Genre must be between 1 and 50 characters"),

  body("language")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Language must be at most 50 characters"),

  body("ageRating")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Age rating must be at most 20 characters"),

  body("posterUrl")
    .optional()
    .custom(
      (value) =>
        typeof value === "string" ||
        (value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          typeof value.url === "string"),
    )
    .withMessage("Invalid poster URL"),

  body("posterUrl")
    .optional()
    .if((value) => typeof value === "string")
    .trim()
    .isURL()
    .withMessage("Invalid poster URL"),

  body("posterUrl.url")
    .optional()
    .trim()
    .isURL()
    .withMessage("Invalid poster URL"),

  body("posterUrl.publicId")
    .optional()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage("Invalid poster URL"),

  body("releaseDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid release date"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const movieIdValidator = [
  param("id").isMongoId().withMessage("Invalid movie ID"),
];

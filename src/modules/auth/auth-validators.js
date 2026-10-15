import { body, param } from "express-validator";

export const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8, max: 128 })
    .withMessage("Password must be between 8 and 128 characters"),

  body("passwordConfirm")
    .trim()
    .custom((passConfirm, { req }) => passConfirm === req.body.password)
    .withMessage("Passwords do not match"),
];

export const loginValidator = [
  body("email")
    .trim()
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 chars"),
];
export const verifyEmailValidator = [
  body("email").trim().isEmail().withMessage("Invalid email").normalizeEmail(),

  body("otp")
    .trim()
    .matches(/^\d{6}$/)
    .withMessage("OTP must be a 6-digit code"),
];

export const resendVerificationValidator = [
  body("email").trim().isEmail().withMessage("Invalid email").normalizeEmail(),
];

export const sessionIdValidator = [
  param("sessionId").isMongoId().withMessage("Invalid session ID"),
];

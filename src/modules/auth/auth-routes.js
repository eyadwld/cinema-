import express from "express";

import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  getSessions,
  revokeSession,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "./auth-controller.js";

import {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  sessionIdValidator,
} from "./auth-validators.js";

import validate from "../../middlewares/validation.js";

import {
  authMiddleware,
  requireAuth,
} from "../../middlewares/is-auth.js";

import asyncHandler from "../../utils/async-handler.js";

const router = express.Router();

router.post("/register", validate(registerValidator), asyncHandler(register));

router.post("/login", validate(loginValidator), asyncHandler(login));

router.post("/logout", asyncHandler(logout));

router.get("/me", authMiddleware, asyncHandler(me));

router.post(
  "/verify-email",
  validate(verifyEmailValidator),
  asyncHandler(verifyEmail),
);

router.post(
  "/resend-verification",
  validate(resendVerificationValidator),
  asyncHandler(resendVerification),
);

router.post(
  "/forgot-password",
  validate(forgotPasswordValidator),
  asyncHandler(forgotPassword),
);

router.post(
  "/reset-password",
  validate(resetPasswordValidator),
  asyncHandler(resetPassword),
);

router.post("/refresh", asyncHandler(refresh));

router.post("/logout-all", authMiddleware, asyncHandler(logoutAll));

router.get("/sessions", authMiddleware, asyncHandler(getSessions));

router.delete(
  "/sessions/:sessionId",
  authMiddleware,
  validate(sessionIdValidator),
  asyncHandler(revokeSession),
);

export default router;

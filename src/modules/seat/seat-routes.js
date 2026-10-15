import express from "express";

import { generate, getByScreen, update, remove } from "./seat-controller.js";

import asyncHandler from "../../utils/async-handler.js";
import { requireAuth, requireAdmin } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import {
  seatScreenIdValidator,
  seatIdValidator,
  updateSeatValidator,
} from "./seat-validators.js";

const router = express.Router();

router.post(
  "/screen/:screenId/generate",
  requireAuth,
  requireAdmin,
  validate(seatScreenIdValidator),
  asyncHandler(generate),
);

router.get(
  "/screen/:screenId",
  validate(seatScreenIdValidator),
  asyncHandler(getByScreen),
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(seatIdValidator),
  validate(updateSeatValidator),
  asyncHandler(update),
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(seatIdValidator),
  asyncHandler(remove),
);

export default router;

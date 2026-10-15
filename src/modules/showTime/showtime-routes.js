import express from "express";

import {
  create,
  getAll,
  getOne,
  update,
  remove,
  getSeats,
  lockSeats,
  unlockSeats,
} from "./showtime-controller.js";

import asyncHandler from "../../utils/async-handler.js";
import { requireAdmin, requireAuth } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import {
  createShowtimeValidator,
  updateShowtimeValidator,
  showtimeIdValidator,
  listShowtimesValidator,
  lockSeatsValidator,
  unlockSeatsValidator,
} from "./showtime-validations.js";

const router = express.Router();

// Public read routes
router.get("/", validate(listShowtimesValidator), asyncHandler(getAll));
router.get("/:id", validate(showtimeIdValidator), asyncHandler(getOne));
router.get(
  "/:id/seats",
  validate(showtimeIdValidator),
  asyncHandler(getSeats),
);

router.post(
  "/",
  requireAuth,
  requireAdmin,
  validate(createShowtimeValidator),
  asyncHandler(create),
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(showtimeIdValidator),
  validate(updateShowtimeValidator),
  asyncHandler(update),
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(showtimeIdValidator),
  asyncHandler(remove),
);

router.post(
  "/:id/seat-locks",
  requireAuth,
  validate(lockSeatsValidator),
  asyncHandler(lockSeats),
);

router.delete(
  "/:id/seat-locks",
  requireAuth,
  validate(unlockSeatsValidator),
  asyncHandler(unlockSeats),
);
export default router;

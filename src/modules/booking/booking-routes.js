import { Router } from "express";
import * as controller from "./booking-controller.js";
import { requireAdmin, requireAuth } from "../../middlewares/is-auth.js";
import validate from "../../middlewares/validation.js";
import {
  bookingIdValidator,
  createBookingValidator,
  listBookingsValidator,
} from "./booking-validator.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validate(listBookingsValidator),
  controller.getAll,
);

router.get(
  "/:bookingId",
  requireAuth,
  validate(bookingIdValidator),
  controller.getOne,
);

router.patch(
  "/:bookingId/cancel",
  requireAuth,
  validate(bookingIdValidator),
  controller.cancel,
);

router.post(
  "/showtimes/:showtimeId",
  requireAuth,
  validate(createBookingValidator),
  controller.create,
);

export default router;

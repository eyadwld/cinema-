import express from "express";

import { create, getAll, getOne, update, remove } from "./cinema-controller.js";

import asyncHandler from "../../utils/async-handler.js";

import { requireAdmin, requireAuth } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import {
  createCinemaValidator,
  updateCinemaValidator,
  cinemaIdValidator,
} from "./cinema-validator.js";

const router = express.Router();

router.get("/", asyncHandler(getAll));

router.get("/:id", validate(cinemaIdValidator), asyncHandler(getOne));

//admin

router.post(
  "/",
  requireAuth,
  requireAdmin,
  validate(createCinemaValidator),
  asyncHandler(create),
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(cinemaIdValidator),
  validate(updateCinemaValidator),
  asyncHandler(update),
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(cinemaIdValidator),
  asyncHandler(remove),
);

export default router;

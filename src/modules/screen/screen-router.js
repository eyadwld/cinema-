import express from "express";

import { create, getByCinema, getOne, update, remove } from "./screen-controller.js";

import asyncHandler from "../../utils/async-handler.js";

import { requireAdmin, requireAuth } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import {
  createScreenValidator,
  updateScreenValidator,
  screenIdValidator,
  cinemaIdParamValidator,
} from "./screen-validator.js";

const router = express.Router();

router.get(
  "/cinema/:cinemaId",
  validate(cinemaIdParamValidator),
  asyncHandler(getByCinema),
);

router.get("/:id", validate(screenIdValidator), asyncHandler(getOne));

router.post(
  "/",
  requireAuth,
  requireAdmin,
  validate(createScreenValidator),
  asyncHandler(create),
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(screenIdValidator),
  validate(updateScreenValidator),
  asyncHandler(update),
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(screenIdValidator),
  asyncHandler(remove),
);

export default router;

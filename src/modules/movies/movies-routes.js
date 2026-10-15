import express from "express";

import { create, getAll, getOne, update, remove } from "./movies-controller.js";

import asyncHandler from "../../utils/async-handler.js";
import { requireAdmin, requireAuth } from "../../middlewares/is-auth.js";

import validate from "../../middlewares/validation.js";

import {
  createMovieValidator,
  updateMovieValidator,
  movieIdValidator,
} from "./movies-validator.js";

import upload from "../../middlewares/upload-image.js";

const router = express.Router();

router.get("/", asyncHandler(getAll));

router.get("/:id", validate(movieIdValidator), asyncHandler(getOne));

router.post(
  "/",
  requireAuth,
  requireAdmin,
  upload.single("Poster"),
  validate(createMovieValidator),
  asyncHandler(create),
);

router.patch(
  "/:id",
  requireAuth,
  requireAdmin,
  upload.single("Poster"),
  validate(movieIdValidator),
  validate(updateMovieValidator),
  asyncHandler(update),
);

router.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  validate(movieIdValidator),
  asyncHandler(remove),
);

export default router;

import Cinema from "../../models/Cinema.js";
import Screen from "../../models/Screen.js";
import AppError from "../../utils/appError.js";

import { generateSeats } from "../seat/seat-service.js";

export const createScreen = async ({
  cinemaId,
  name,
  rows,
  columns,
  generateSeats: autoGenerateSeats,
}) => {
  const cinema = await Cinema.findOne({
    _id: cinemaId,
    isActive: true,
  }).lean();

  if (!cinema) {
    throw new AppError("Cinema not found or inactive", 404);
  }

  const existingScreen = await Screen.findOne({
    cinemaId,
    name,
  }).lean();

  if (existingScreen) {
    throw new AppError(
      "A screen with this name already exists in this cinema",
      409,
    );
  }

  const screen = await Screen.create({
    cinemaId,
    name,
    rows,
    columns,
  });

  let seatsGenerated = 0;

  if (autoGenerateSeats === true) {
    const seats = await generateSeats(screen._id);

    seatsGenerated = seats.length;
  }

  return { screen, seatsGenerated };
};

export const getCinemaScreens = async (cinemaId) => {
  const cinema = await Cinema.findOne({
    _id: cinemaId,
    isActive: true,
  }).lean();

  if (!cinema) {
    throw new AppError("Cinema not found", 404);
  }

  return Screen.find({
    cinemaId,
    isActive: true,
  })
    .sort({ createdAt: 1 })
    .lean();
};

export const getScreenById = async (screenId) => {
  const screen = await Screen.findOne({
    _id: screenId,
    isActive: true,
  }).lean();

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  return screen;
};

export const updateScreen = async (screenId, updates) => {
  const allowedUpdates = {};

  if (updates.name !== undefined) {
    allowedUpdates.name = updates.name;
  }

  if (updates.isActive !== undefined) {
    allowedUpdates.isActive = updates.isActive;
  }

  if (updates.rows !== undefined) {
    allowedUpdates.rows = updates.rows;
  }

  if (updates.columns !== undefined) {
    allowedUpdates.columns = updates.columns;
  }

  const screen = await Screen.findByIdAndUpdate(
    screenId,
    {
      $set: allowedUpdates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  return screen;
}; // if seats created not update rows and coulmns

export const deleteScreen = async (screenId) => {
  const screen = await Screen.findByIdAndUpdate(
    screenId,
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  return screen;
};

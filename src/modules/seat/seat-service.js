import Screen from "../../models/Screen.js";
import Seat from "../../models/Seat.js";
import AppError from "../../utils/appError.js";

const rowToLetter = (index) => {
  let result = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;

    result = String.fromCharCode(65 + remainder) + result;

    value = Math.floor((value - 1) / 26);
  }

  return result;
};

export const generateSeats = async (screenId) => {
  const screen = await Screen.findOne({
    _id: screenId,
    isActive: true,
  });

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  const existingSeats = await Seat.countDocuments({
    screenId,
  });

  if (existingSeats > 0) {
    throw new AppError(
      "Seats have already been generated for this screen",
      409,
    );
  }

  const seats = [];

  for (let rowIndex = 0; rowIndex < screen.rows; rowIndex++) {
    const row = rowToLetter(rowIndex);

    for (let number = 1; number <= screen.columns; number++) {
      seats.push({
        screenId: screen._id,
        row,
        number,
        type: "STANDARD",
      });
    }
  }

  return Seat.insertMany(seats);
};

export const getScreenSeats = async (screenId) => {
  const screen = await Screen.findOne({
    _id: screenId,
    isActive: true,
  }).lean();

  if (!screen) {
    throw new AppError("Screen not found", 404);
  }

  return Seat.find({
    screenId,
    isActive: true,
  })
    .sort({
      row: 1,
      number: 1,
    })
    .lean();
};

export const updateSeat = async (seatId, updates) => {
  const allowedUpdates = {};

  if (updates.type !== undefined) {
    allowedUpdates.type = updates.type;
  }

  if (updates.isActive !== undefined) {
    allowedUpdates.isActive = updates.isActive;
  }

  const seat = await Seat.findByIdAndUpdate(
    seatId,
    {
      $set: allowedUpdates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!seat) {
    throw new AppError("Seat not found", 404);
  }

  return seat;
};

export const deleteSeat = async (seatId) => {
  const seat = await Seat.findByIdAndUpdate(
    seatId,
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!seat) {
    throw new AppError("Seat not found", 404);
  }

  return seat;
};

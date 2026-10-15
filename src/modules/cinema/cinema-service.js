import Cinema from "../../models/Cinema.js";
import AppError from "../../utils/appError.js";

export const createCinema = async ({ name, city, address }) => {
  const cinema = await Cinema.create({
    name,
    city,
    address,
  });

  return cinema;
};

export const getCinemas = async () => {
  return Cinema.find({
    isActive: true,
  })
    .sort({ createdAt: -1 })
    .lean();
};

export const getCinemaById = async (cinemaId) => {
  const cinema = await Cinema.findOne({
    _id: cinemaId,
    isActive: true,
  }).lean();

  if (!cinema) {
    throw new AppError("Cinema not found", 404);
  }

  return cinema;
};

export const updateCinema = async (cinemaId, updates) => {
  const allowedUpdates = {};

  if (updates.name !== undefined) {
    allowedUpdates.name = updates.name;
  }

  if (updates.city !== undefined) {
    allowedUpdates.city = updates.city;
  }

  if (updates.address !== undefined) {
    allowedUpdates.address = updates.address;
  }

  if (updates.isActive !== undefined) {
    allowedUpdates.isActive = updates.isActive;
  }

  const cinema = await Cinema.findByIdAndUpdate(
    cinemaId,
    {
      $set: allowedUpdates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!cinema) {
    throw new AppError("Cinema not found", 404);
  }

  return cinema;
};

export const deleteCinema = async (cinemaId) => {
  const cinema = await Cinema.findByIdAndUpdate(
    cinemaId,
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!cinema) {
    throw new AppError("Cinema not found", 404);
  }

  return cinema;
};

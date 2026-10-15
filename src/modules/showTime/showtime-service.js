import Movie from "../../models/Movie.js";
import Screen from "../../models/Screen.js";
import Showtime from "../../models/Showtime.js";
import AppError from "../../utils/appError.js";
import Seat from "../../models/Seat.js";
import BookingSeat from "../../models/BookingSeat.js";

import { redisClient } from "../../config/redis.js";

import crypto from "crypto";
import mongoose from "mongoose";

export const createShowtime = async ({
  movieId,
  screenId,
  startsAt,
  price,
}) => {
  const movie = await Movie.findOne({
    _id: movieId,
    isActive: true,
  }).lean();

  if (!movie) {
    throw new AppError("Movie not found or inactive", 404);
  }

  const screen = await Screen.findOne({
    _id: screenId,
    isActive: true,
  }).lean();

  if (!screen) {
    throw new AppError("Screen not found or inactive", 404);
  }

  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    throw new AppError("Invalid start time", 400);
  }

  const end = new Date(start.getTime() + movie.durationMinutes * 60 * 1000);

  if (start <= new Date()) {
    throw new AppError("Showtime must start in the future", 400);
  }

  const overlappingShowtime = await Showtime.findOne({
    screenId,

    startsAt: {
      $lt: end,
    },

    endsAt: {
      $gt: start,
    },

    isActive: true,
  }).lean();

  if (overlappingShowtime) {
    throw new AppError("Screen already has an overlapping showtime", 409);
  }

  const showtime = await Showtime.create({
    movieId,
    screenId,
    startsAt: start,
    endsAt: end,
    price,
  });

  /*
   * Return the populated view, the same shape
   * getShowtimeById serves, so the admin sees
   * movie, screen and cinema names immediately.
   */
  return getShowtimeById(showtime._id);
};

export const updateShowtime = async (showtimeId, updates) => {
  const showtime = await Showtime.findOne({
    _id: showtimeId,
    isActive: true,
  });

  if (!showtime) {
    throw new AppError("Showtime not found", 404);
  }

  if (updates.price !== undefined) {
    showtime.price = updates.price;
  }

  if (updates.isActive !== undefined) {
    showtime.isActive = updates.isActive;
  }

  if (updates.startsAt !== undefined) {
    const movie = await Movie.findById(showtime.movieId).lean();

    if (!movie) {
      throw new AppError("Movie not found", 404);
    }

    const newStart = new Date(updates.startsAt);

    if (Number.isNaN(newStart.getTime())) {
      throw new AppError("Invalid start time", 400);
    }

    const newEnd = new Date(
      newStart.getTime() + movie.durationMinutes * 60 * 1000,
    );

    const overlapping = await Showtime.findOne({
      _id: {
        $ne: showtimeId,
      },

      screenId: showtime.screenId,

      startsAt: {
        $lt: newEnd,
      },

      endsAt: {
        $gt: newStart,
      },

      isActive: true,
    }).lean();

    if (overlapping) {
      throw new AppError("Screen already has an overlapping showtime", 409);
    }

    showtime.startsAt = newStart;
    showtime.endsAt = newEnd;
  }

  await showtime.save();

  return showtime;
};

export const deleteShowtime = async (showtimeId) => {
  const showtime = await Showtime.findByIdAndUpdate(
    showtimeId,
    {
      $set: {
        isActive: false,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!showtime) {
    throw new AppError("Showtime not found", 404);
  }

  return showtime;
};

export const getShowtimes = async ({
  movieId,
  screenId,
  cinemaId,
  from,
  to,
} = {}) => {
  const filter = {
    isActive: true,
    startsAt: { $gte: new Date() },
  };

  if (movieId) {
    if (!mongoose.isValidObjectId(movieId)) {
      throw new AppError("Invalid movie ID", 400);
    }

    filter.movieId = movieId;
  }

  if (screenId) {
    if (!mongoose.isValidObjectId(screenId)) {
      throw new AppError("Invalid screen ID", 400);
    }

    filter.screenId = screenId;
  }

  if (from || to) {
    const start = from ? new Date(from) : new Date();

    if (Number.isNaN(start.getTime())) {
      throw new AppError("Invalid from date", 400);
    }

    const end = to ? new Date(to) : undefined;

    if (to && Number.isNaN(end.getTime())) {
      throw new AppError("Invalid to date", 400);
    }

    if (end && end <= start) {
      throw new AppError("'to' must be after 'from'", 400);
    }

    filter.startsAt = { $gte: start };

    if (end) {
      filter.startsAt.$lte = end;
    }
  }

  let query = Showtime.find(filter)
    .populate([
      {
        path: "movieId",
        select:
          "title description durationMinutes genre language ageRating posterUrl",
      },
      {
        path: "screenId",
        select: "name cinemaId",
        populate: {
          path: "cinemaId",
          select: "name city address",
        },
      },
    ])
    .sort({ startsAt: 1 });

  const showtimes = await query.lean();

  // Filter by cinema after population because cinemaId belongs to Screen.
  const result = cinemaId
    ? (() => {
        if (!mongoose.isValidObjectId(cinemaId)) {
          throw new AppError("Invalid cinema ID", 400);
        }

        return showtimes.filter(
          (showtime) =>
            showtime.screenId?.cinemaId?._id?.toString() ===
            cinemaId.toString(),
        );
      })()
    : showtimes;

  return result;
};

export const getShowtimeById = async (showtimeId) => {
  if (!mongoose.isValidObjectId(showtimeId)) {
    throw new AppError("Invalid showtime ID", 400);
  }

  const showtime = await Showtime.findOne({
    _id: showtimeId,
    isActive: true,
  })
    .populate([
      {
        path: "movieId",
        select:
          "title description durationMinutes genre language ageRating posterUrl",
      },
      {
        path: "screenId",
        select: "name cinemaId",
        populate: {
          path: "cinemaId",
          select: "name city address",
        },
      },
    ])
    .lean();

  if (!showtime) {
    throw new AppError("Showtime not found", 404);
  }

  return showtime;
};

export const getShowtimeSeats = async (showtimeId) => {
  if (!mongoose.isValidObjectId(showtimeId)) {
    throw new AppError("Invalid showtime ID", 400);
  }

  const showtime = await Showtime.findOne({
    _id: showtimeId,
    isActive: true,
    startsAt: { $gt: new Date() },
  })
    .select("_id screenId startsAt")
    .lean();

  if (!showtime) {
    throw new AppError("Upcoming showtime not found", 404);
  }

  if (!redisClient.isReady) {
    throw new AppError("Seat availability is temporarily unavailable", 503);
  }

  const seats = await Seat.find({
    screenId: showtime.screenId,
    isActive: true,
  })
    .select("_id row number type")
    .sort({ row: 1, number: 1 })
    .lean();

  if (seats.length === 0) {
    return { showtimeId, seats: [] };
  }

  const seatIds = seats.map((seat) => seat._id);

  const bookedSeats = await BookingSeat.find({
    showtimeId,
    seatId: { $in: seatIds },
  })
    .select("seatId")
    .lean();

  const bookedSeatIds = new Set(
    bookedSeats.map((item) => item.seatId.toString()),
  );

  const lockKeys = seats.map(
    (seat) => `lock:showtime:${showtimeId}:seat:${seat._id}`,
  );

  const lockValues = await redisClient.mGet(lockKeys);

  const result = seats.map((seat, index) => {
    const seatId = seat._id.toString();

    let status = "AVAILABLE";

    if (bookedSeatIds.has(seatId)) {
      status = "BOOKED";
    } else if (lockValues[index] !== null) {
      status = "LOCKED";
    }

    return {
      ...seat,
      status,
    };
  });

  return {
    showtimeId,
    seats: result,
  };
};

const SEAT_LOCK_TTL_SECONDS = 300;
const MAX_SEATS_PER_REQUEST = 10;

const buildSeatLockKeys = (showtimeId, seatIds) =>
  seatIds.map((seatId) => `lock:showtime:${showtimeId}:seat:${seatId}`);

export const acquireSeatLocks = async ({ showtimeId, seatIds, userId }) => {
  if (!mongoose.isValidObjectId(showtimeId)) {
    throw new AppError("Invalid showtime ID", 400);
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError("Invalid user ID", 400);
  }

  if (
    !Array.isArray(seatIds) ||
    seatIds.length === 0 ||
    seatIds.length > MAX_SEATS_PER_REQUEST
  ) {
    throw new AppError(
      `Choose between 1 and ${MAX_SEATS_PER_REQUEST} seats`,
      400,
    );
  }

  if (!seatIds.every((id) => mongoose.isValidObjectId(id))) {
    throw new AppError("One or more seat IDs are invalid", 400);
  }

  const normalizedSeatIds = seatIds.map(String);

  if (new Set(normalizedSeatIds).size !== normalizedSeatIds.length) {
    throw new AppError("Duplicate seat IDs are not allowed", 400);
  }

  if (!redisClient.isReady) {
    throw new AppError("Seat locking is temporarily unavailable", 503);
  }

  const showtime = await Showtime.findOne({
    _id: showtimeId,
    isActive: true,
    startsAt: { $gt: new Date() },
  })
    .select("_id screenId")
    .lean();

  if (!showtime) {
    throw new AppError("Upcoming showtime not found", 404);
  }

  const seats = await Seat.find({
    _id: { $in: normalizedSeatIds },
    screenId: showtime.screenId,
    isActive: true,
  })
    .select("_id")
    .lean();

  if (seats.length !== normalizedSeatIds.length) {
    throw new AppError("One or more seats are invalid or unavailable", 400);
  }

  const bookedSeat = await BookingSeat.exists({
    showtimeId,
    seatId: { $in: normalizedSeatIds },
  });

  if (bookedSeat) {
    throw new AppError("One or more seats have already been booked", 409);
  }

  const lockToken = crypto.randomUUID();
  const ownerToken = `${userId}:${lockToken}`;
  const keys = buildSeatLockKeys(showtimeId, normalizedSeatIds);

  const script = `
    local ownerToken = ARGV[1]
    local ttl = tonumber(ARGV[2])

    -- Phase 1: check every requested seat.
    for i = 1, #KEYS do
        if redis.call("EXISTS", KEYS[i]) == 1 then
            return {0, i}
        end
    end

    -- Phase 2: acquire all locks.
    for i = 1, #KEYS do
        redis.call(
            "SET",
            KEYS[i],
            ownerToken,
            "EX",
            ttl
        )
    end

    return {1, #KEYS}
`;

  const result = await redisClient.eval(script, {
    keys,
    arguments: [ownerToken, String(SEAT_LOCK_TTL_SECONDS)],
  });

  switch (Number(result[0])) {
    case 1:
      return {
        showtimeId,
        seatIds,
        lockToken,
        expiresInSeconds: SEAT_LOCK_TTL_SECONDS,
      };

    case 0: {
      const conflictingIndex = Number(result[1]) - 1;

      throw new AppError(
        `Seat ${seatIds[conflictingIndex]} is already locked`,
        409,
      );
    }

    default:
      throw new Error("Unexpected seat-lock result");
  }
};

export const releaseSeatLocks = async ({
  showtimeId,
  seatIds,
  userId,
  lockToken,
}) => {
  if (
    !mongoose.isValidObjectId(showtimeId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new AppError("Invalid ID", 400);
  }

  if (
    !Array.isArray(seatIds) ||
    seatIds.length === 0 ||
    seatIds.length > MAX_SEATS_PER_REQUEST ||
    !seatIds.every((id) => mongoose.isValidObjectId(id)) ||
    new Set(seatIds.map(String)).size !== seatIds.length
  ) {
    throw new AppError("Invalid seat IDs", 400);
  }

  if (!redisClient.isReady) {
    throw new AppError("Seat locking is temporarily unavailable", 503);
  }

  const keys = buildSeatLockKeys(showtimeId, seatIds);
  const ownerToken = `${userId}:${lockToken}`;
  const script = `
    local released = 0

    for i = 1, #KEYS do
      local current = redis.call("GET", KEYS[i])

      if current ~= ARGV[1] then
        return 1
      end
    end

    for i = 1, #KEYS do
      redis.call("DEL", KEYS[i])
      released = released + 1
    end

    return released
  `;

  const released = await redisClient.eval(script, {
    keys,
    arguments: [ownerToken],
  });

  switch (Number(released)) {
    case 1:
      throw new AppError(
        "One or more seat locks are missing or do not belong to you",
        409,
      );

    default:
      return {
        released: Number(released),
      };
  }
};

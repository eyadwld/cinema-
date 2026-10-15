import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import BookingSeat from "../../models/BookingSeat.js";
import Showtime from "../../models/Showtime.js";
import Seat from "../../models/Seat.js";
import AppError from "../../utils/appError.js";
import { redisClient } from "../../config/redis.js";
import OutboxEvent from "../../models/OutboxEvent.js";
import User from "../../models/User.js";

const BOOKING_PAYMENT_TTL_MS = 5 * 60 * 1000;
const MAX_SEATS_PER_BOOKING = 10;

const RELEASE_SEAT_LOCKS_SCRIPT = `
  local released = 0

  for i = 1, #KEYS do
    if redis.call("GET", KEYS[i]) == ARGV[1] then
      redis.call("DEL", KEYS[i])
      released = released + 1
    end
  end

  return released
`;

const buildSeatLockKeys = (showtimeId, seatIds) =>
  seatIds.map((seatId) => `lock:showtime:${showtimeId}:seat:${seatId}`);
export const createBooking = async ({
  userId,
  showtimeId,
  seatIds,
  lockToken,
}) => {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(showtimeId)
  ) {
    throw new AppError("Invalid user or showtime ID", 400);
  }

  if (
    !Array.isArray(seatIds) ||
    seatIds.length === 0 ||
    seatIds.length > MAX_SEATS_PER_BOOKING ||
    !seatIds.every((id) => mongoose.isValidObjectId(id))
  ) {
    throw new AppError("Invalid seat selection", 400);
  }

  const normalizedSeatIds = seatIds.map(String);

  if (new Set(normalizedSeatIds).size !== normalizedSeatIds.length) {
    throw new AppError("Duplicate seat IDs are not allowed", 400);
  }

  if (typeof lockToken !== "string" || !/^[0-9a-f-]{36}$/i.test(lockToken)) {
    throw new AppError("Invalid lock token", 400);
  }

  if (!redisClient.isReady) {
    throw new AppError("Seat locking is temporarily unavailable", 503);
  }

  const ownerToken = `${userId}:${lockToken}`;
  const lockKeys = buildSeatLockKeys(showtimeId, normalizedSeatIds);

  // Check that the user still owns every requested lock.
  const currentLocks = await redisClient.mGet(lockKeys);

  if (currentLocks.some((value) => value !== ownerToken)) {
    throw new AppError("Your seat lock has expired or is no longer valid", 409);
  }

  const session = await mongoose.startSession();
  let booking;

  try {
    await session.withTransaction(async () => {
      const now = new Date();

      const showtime = await Showtime.findOne({
        _id: showtimeId,
        isActive: true,
        startsAt: { $gt: now },
      })
        .session(session)
        .lean();

      if (!showtime) {
        throw new AppError("Showtime is no longer available", 409);
      }

      const seats = await Seat.find({
        _id: { $in: normalizedSeatIds },
        screenId: showtime.screenId,
        isActive: true,
      })
        .select("_id")
        .session(session)
        .lean();

      if (seats.length !== normalizedSeatIds.length) {
        throw new AppError("One or more seats are no longer available", 409);
      }

      const existingSeat = await BookingSeat.findOne({
        showtimeId,
        seatId: { $in: normalizedSeatIds },
      })
        .session(session)
        .lean();

      if (existingSeat) {
        throw new AppError("One or more seats have already been booked", 409);
      }

      const expiresAt = new Date(now.getTime() + BOOKING_PAYMENT_TTL_MS);

      const pricePerSeatMinor = Math.round(showtime.price * 100);

      if (!Number.isSafeInteger(pricePerSeatMinor) || pricePerSeatMinor <= 0) {
        throw new AppError("Invalid showtime price", 500);
      }

      const totalAmountMinor = pricePerSeatMinor * seatIds.length;

      if (!Number.isSafeInteger(totalAmountMinor)) {
        throw new AppError("Invalid booking total", 500);
      }
      const [createdBooking] = await Booking.create(
        [
          {
            userId,
            showtimeId,
            seatIds: normalizedSeatIds,
            status: "PENDING_PAYMENT",
            totalAmountMinor: totalAmountMinor,
            currency: "EGP",
            expiresAt,
          },
        ],
        { session },
      );

      await BookingSeat.insertMany(
        normalizedSeatIds.map((seatId) => ({
          showtimeId,
          seatId,
          bookingId: createdBooking._id,
        })),
        { session },
      );

      // Persist the expiry event in the SAME transaction.
      await OutboxEvent.create(
        [
          {
            type: "EXPIRE_BOOKING",
            aggregateId: createdBooking._id,
            payload: {
              bookingId: createdBooking._id.toString(),
              expiresAt: expiresAt.toISOString(),
            },
            status: "PENDING",
            attempts: 0,
          },
        ],
        { session },
      );

      booking = createdBooking;
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("One or more seats have already been booked", 409);
    }

    throw error;
  } finally {
    await session.endSession();
  }

  // Release only this owner's locks after the DB commit.
  if (booking && redisClient.isReady) {
    try {
      await redisClient.eval(RELEASE_SEAT_LOCKS_SCRIPT, {
        keys: lockKeys,
        arguments: [ownerToken],
      });
    } catch (error) {
      // The booking is already committed. Redis TTL is the fallback.
      console.error("Seat lock cleanup failed", {
        bookingId: booking._id.toString(),
        error: error.message,
      });
    }
  }

  return booking;
};

export const getBookings = async ({ status, limit = 50 } = {}) => {
  const filter = {};

  if (status) {
    filter.status = status;
  }

  return Booking.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
};

const assertBookingAccess = async (booking, userId) => {
  if (String(booking.userId) === String(userId)) {
    return;
  }

  const user = await User.findById(userId).select("role").lean();

  if (!user || user.role !== "ADMIN") {
    throw new AppError("Booking not found", 404);
  }
};

export const getBookingById = async ({ bookingId, userId }) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    throw new AppError("Invalid booking ID", 400);
  }

  const booking = await Booking.findById(bookingId).lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  await assertBookingAccess(booking, userId);

  return booking;
};

export const cancelBooking = async ({ bookingId, userId }) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    throw new AppError("Invalid booking ID", 400);
  }

  const session = await mongoose.startSession();
  let cancelled = null;

  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);

      if (!booking) {
        throw new AppError("Booking not found", 404);
      }

      await assertBookingAccess(booking, userId);

      if (booking.status !== "PENDING_PAYMENT") {
        throw new AppError("Only pending bookings can be cancelled", 409);
      }

      booking.status = "CANCELLED";

      await booking.save({ session });

      await BookingSeat.deleteMany({ bookingId: booking._id }, { session });

      cancelled = booking;
    });
  } finally {
    await session.endSession();
  }

  return cancelled;
};

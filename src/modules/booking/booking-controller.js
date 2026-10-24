import asyncHandler from "../../utils/async-handler.js";
import * as bookingService from "./booking-service.js";

export const create = asyncHandler(async (req, res) => {
  const booking = await bookingService.createBooking({
    userId: req.auth.userId,
    showtimeId: req.params.showtimeId,
    seatIds: req.body.seatIds,
    lockToken: req.body.lockToken,
  });

  res.status(201).json({
    success: true,
    message: "Booking created. Complete payment before it expires.",
    data: { booking },
  });
});

export const getAll = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getBookings({
    status: req.query.status,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.status(200).json({
    success: true,
    results: bookings.length,
    data: { bookings },
  });
});

export const getMine = asyncHandler(async (req, res) => {
  const bookings = await bookingService.getBookingsList({
    userId: req.auth.userId,
    status: req.query.status,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });

  res.status(200).json({
    success: true,
    results: bookings.length,
    data: { bookings },
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const booking = await bookingService.getBookingById({
    bookingId: req.params.bookingId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    data: { booking },
  });
});

export const cancel = asyncHandler(async (req, res) => {
  const booking = await bookingService.cancelBooking({
    bookingId: req.params.bookingId,
    userId: req.auth.userId,
  });

  res.status(200).json({
    success: true,
    message: "Booking cancelled successfully",
    data: { booking },
  });
});

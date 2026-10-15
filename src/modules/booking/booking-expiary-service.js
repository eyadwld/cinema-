import mongoose from "mongoose";
import Booking from "../../models/Booking.js";
import BookingSeat from "../../models/BookingSeat.js";
import Payment from "../../models/Payment.js";
import { markBookingPaymentsFailed } from "../payment/payment-service.js";

export const expireBooking = async (bookingId) => {
  if (!mongoose.isValidObjectId(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const session = await mongoose.startSession();

  try {
    let expired = false;

    await session.withTransaction(async () => {
      const paid = await Payment.findOne({ bookingId, status: "SUCCESS" }).session(session).lean();

      if (paid) {
        return;
      }

      const now = new Date();

      // Claim the expiry by changing the status only if the booking
      // is still pending and its deadline has passed.
      const booking = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          status: "PENDING_PAYMENT",
          expiresAt: { $lte: now },
        },
        {
          $set: { status: "EXPIRED" },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!booking) {
        // It may already be confirmed, cancelled, or expired.
        return;
      }

      await BookingSeat.deleteMany({ bookingId: booking._id }, { session });

      await markBookingPaymentsFailed(booking._id, session);

      expired = true;
    });

    return { expired };
  } finally {
    await session.endSession();
  }
};

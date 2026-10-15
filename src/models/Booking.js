import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
      index: true,
    },
    seatIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Seat",
        },
      ],
      required: true,
      validate: {
        validator: (ids) =>
          Array.isArray(ids) &&
          ids.length > 0 &&
          new Set(ids.map(String)).size === ids.length,
        message: "A booking must contain unique seats",
      },
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "CONFIRMED", "EXPIRED", "CANCELLED"],
      default: "PENDING_PAYMENT",
      required: true,
      index: true,
    },
    totalAmountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "totalAmountMinor must be a safe integer",
      },
    },
    currency: {
      type: String,
      default: "EGP",
      required: true,
      enum: ["EGP"],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model("Booking", bookingSchema);

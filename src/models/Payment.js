import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: ["PAYMOB"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"],
      default: "PENDING",
      required: true,
      index: true,
    },

    // Always in the smallest currency unit, e.g. piastres for EGP.
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "amountMinor must be a safe integer",
      },
    },

    currency: {
      type: String,
      enum: ["EGP"],
      default: "EGP",
      required: true,
    },

    successfulAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentAttempt",
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// One logical payment per booking.
paymentSchema.index({ bookingId: 1 }, { unique: true });
paymentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);

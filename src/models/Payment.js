import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
      index: true,
    },
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
      default: "EGP",
      required: true,
      enum: ["EGP"],
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
      required: true,
      index: true,
    },
    paymobIntentionId: {
      type: String,
      default: null,
      index: true,
    },
    paymobOrderId: {
      type: Number,
      default: null,
      index: true,
    },
    clientSecret: {
      type: String,
      default: null,
      select: false,
    },
    checkoutUrl: {
      type: String,
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("Payment", paymentSchema);

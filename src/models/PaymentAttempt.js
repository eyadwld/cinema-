import mongoose from "mongoose";

const paymentAttemptSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["INITIATED", "SUCCESS", "FAILED"],
      default: "INITIATED",
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
    paymobIntentionId: {
      type: String,
      default: null,
      index: true,
    },
    paymobTransactionId: {
      type: String,
      default: null,
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

paymentAttemptSchema.index({ paymentId: 1, createdAt: -1 });
paymentAttemptSchema.index({ status: 1, createdAt: 1 });

export default mongoose.model("PaymentAttempt", paymentAttemptSchema);

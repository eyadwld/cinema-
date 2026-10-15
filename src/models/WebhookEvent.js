import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["PAYMOB"],
      required: true,
    },

    eventId: {
      type: String,
      required: true,
    },

    eventFingerprint: {
      type: String,
      required: true,
    },

    eventType: {
      type: String,
      required: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    paymentAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentAttempt",
      default: null,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

webhookEventSchema.index(
  { provider: 1, eventFingerprint: 1 },
  { unique: true },
);

export default mongoose.model("WebhookEvent", webhookEventSchema);

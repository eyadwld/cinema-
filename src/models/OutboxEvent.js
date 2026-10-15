import mongoose from "mongoose";

const outboxEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "VERIFY_EMAIL",
        "BOOKING_CONFIRMATION",
        "EXPIRE_BOOKING",
        "RECONCILE_PAYMENT_ATTEMPT",
        "CONFIRM_PAID_BOOKING",
        "PAYMENT_RECONCILIATION_REQUIRED",
      ],
      required: true,
    },

    aggregateId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    status: {
      type: String,

      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],

      default: "PENDING",
    },

    attempts: {
      type: Number,
      default: 0,
    },

    processingAt: {
      type: Date,
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: null,
    },
    dedupeKey: {
      type: String,
      default: null,
    },
  },

  {
    timestamps: true,
  },
);

outboxEventSchema.index({
  status: 1,
  createdAt: 1,
});

outboxEventSchema.index({
  status: 1,
  processingAt: 1,
});

outboxEventSchema.index(
  { dedupeKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: { $type: "string" },
    },
  },
);

export default mongoose.model("OutboxEvent", outboxEventSchema);

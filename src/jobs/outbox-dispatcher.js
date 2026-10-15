import OutboxEvent from "../models/OutboxEvent.js";

import emailQueue from "../queues/email-queue.js";

import { bookingQueue } from "../queues/booking-queue.js";

import { paymentQueue } from "../queues/payment-queue.js";

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_OUTBOX_ATTEMPTS = 10; //of retry

export const recoverStuckEvents = async () => {
  const threshold = new Date(Date.now() - PROCESSING_TIMEOUT_MS);

  await OutboxEvent.updateMany(
    {
      status: "PROCESSING",
      processingAt: {
        $lt: threshold,
      },
    },
    {
      $set: {
        status: "PENDING",
        processingAt: null,
      },
    },
  );
};

const claimEvent = async (eventId) => {
  return OutboxEvent.findOneAndUpdate(
    {
      _id: eventId,
      status: "PENDING",
    },
    {
      $set: {
        status: "PROCESSING",
        processingAt: new Date(),
      },

      $inc: {
        attempts: 1,
      },
    },
    { returnDocument: "after" },
  );
};

const dispatchEvent = async (event) => {
  switch (event.type) {
    case "VERIFY_EMAIL":
      await emailQueue.add(
        "verify-email",
        {
          userId: event.aggregateId.toString(),

          email: event.payload.email,

          otp: event.payload.otp,
        },
        {
          jobId: `outbox-${event._id}`,
        },
      );

      break;

    case "EXPIRE_BOOKING": {
      const { bookingId, expiresAt } = event.payload;

      await bookingQueue.add(
        "expire-booking",
        { bookingId },
        {
          jobId: `expire-booking-${bookingId}`,
          delay: Math.max(0, new Date(expiresAt).getTime() - Date.now()),
        },
      );

      break;
    }

    case "RECONCILE_PAYMENT_ATTEMPT": {
      const { attemptId } = event.payload;

      await paymentQueue.add(
        "reconcile-payment-attempt",
        { attemptId },
        {
          // The outbox event gets its own job identity.
          jobId: `outbox-${event._id}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5_000,
          },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );

      break;
    }

    case "CONFIRM_PAID_BOOKING": {
      const { paymentId, attemptId } = event.payload;

      await paymentQueue.add(
        "confirm-paid-booking",
        { paymentId, attemptId },
        {
          jobId: `confirm-paid-booking-${attemptId}`,
        },
      );

      break;
    }

    case "PAYMENT_RECONCILIATION_REQUIRED": {
      // Connect this to your existing operational alert/review mechanism.
      // Do not silently discard the event.
      console.error("Payment requires manual review", event.payload);

      break;
    }

    case "BOOKING_CONFIRMATION": {
      const { bookingId, userId } = event.payload;

      // Replace this with the notification queue/job already used
      // by your project for booking confirmation emails.
      await emailQueue.add(
        "booking-confirmation",
        { bookingId, userId },
        {
          jobId: `booking-confirmation-${bookingId}`,
        },
      );

      break;
    }

    default:
      throw new Error(`Unknown outbox event: ${event.type}`);
  }
};

export const processOutbox = async () => {
  const events = await OutboxEvent.find({
    status: "PENDING",
  })
    .sort({
      createdAt: 1,
    })
    .limit(50)
    .lean();

  for (const event of events) {
    const claimed = await claimEvent(event._id);

    if (!claimed) {
      continue;
    }

    try {
      await dispatchEvent(claimed);

      await OutboxEvent.updateOne(
        {
          _id: claimed._id,
          status: "PROCESSING",
        },

        {
          $set: {
            status: "COMPLETED",
            processedAt: new Date(),
            processingAt: null,
          },
        },
      );
    } catch (error) {
      const update = {
        $set: {
          processingAt: null,
          lastError: error.message,
        },
      };

      if (claimed.attempts >= MAX_OUTBOX_ATTEMPTS) {
        update.$set.status = "FAILED";
      } else {
        update.$set.status = "PENDING";
      }

      await OutboxEvent.updateOne(
        {
          _id: claimed._id,
          status: "PROCESSING",
        },
        update,
      );
    }
  }
};

import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import { paymentQueue } from "../queues/payment-queue.js";
import { error as logError } from "../utils/logger.js";

const STALE_ATTEMPT_MS = 2 * 60 * 1000;
const SUCCESS_RECOVERY_LIMIT = 20;

export const recoverStalePaymentAttempts = async () => {
  const threshold = new Date(Date.now() - STALE_ATTEMPT_MS);

  const attempts = await PaymentAttempt.find({
    status: "INITIATED",
    createdAt: { $lt: threshold },
  })
    .select("_id")
    .limit(20)
    .lean();

  for (const attempt of attempts) {
    try {
      await paymentQueue.add(
        "reconcile-payment-attempt",
        { attemptId: attempt._id.toString() },
        {
          jobId: `recover-${attempt._id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );
    } catch (error) {
      if (error?.message?.includes("Job already exists") || error?.code === "JOB_EXISTS") {
        continue;
      }

      logError("Recover stale attempt failed", { attemptId: attempt._id.toString(), error: error.message });
    }
  }
};

export const recoverStaleInProgressAttempts = async () => {
  const threshold = new Date(Date.now() - 10 * 60 * 1000);

  const payments = await Payment.find({
    status: "PENDING",
    createdAt: { $lt: threshold },
  })
    .select("_id")
    .limit(20)
    .lean();

  for (const payment of payments) {
    const attempt = await PaymentAttempt.findOne({ paymentId: payment._id }).sort({ createdAt: -1 }).lean();

    if (!attempt || attempt.status !== "INITIATED") {
      continue;
    }

    try {
      await paymentQueue.add(
        "reconcile-payment-attempt",
        { attemptId: attempt._id.toString() },
        {
          jobId: `recover-inprogress-${attempt._id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );
    } catch (error) {
      if (error?.message?.includes("Job already exists") || error?.code === "JOB_EXISTS") {
        continue;
      }

      logError("Recover in-progress attempt failed", { attemptId: attempt._id.toString(), error: error.message });
    }
  }
};

export const recoverSuccessfulPaymentsWithoutConfirmedBookings = async () => {
  const payments = await Payment.find({ status: "SUCCESS" }).select("_id bookingId").limit(SUCCESS_RECOVERY_LIMIT).lean();

  for (const payment of payments) {
    const booking = await Booking.findById(payment.bookingId).select("status").lean();

    if (!booking || booking.status !== "PENDING_PAYMENT") {
      continue;
    }

    const attempt = await PaymentAttempt.findOne({ paymentId: payment._id }).sort({ createdAt: -1 }).lean();

    try {
      await paymentQueue.add(
        "confirm-paid-booking",
        {
          paymentId: payment._id.toString(),
          attemptId: attempt?._id?.toString() || null,
        },
        {
          jobId: `recover-confirm-${payment._id}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );
    } catch (error) {
      if (error?.message?.includes("Job already exists") || error?.code === "JOB_EXISTS") {
        continue;
      }

      logError("Recover paid booking failed", { paymentId: payment._id.toString(), error: error.message });
    }
  }
};

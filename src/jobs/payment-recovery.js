import Payment from "../models/Payment.js";
import PaymentAttempt from "../models/PaymentAttempt.js";
import { paymentQueue } from "../queues/payment-queue.js";

const STARTED_TIMEOUT_MS = 60_000;

const IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;

export async function recoverStaleInProgressAttempts() {
  const cutoff = new Date(Date.now() - IN_PROGRESS_TIMEOUT_MS);

  const stale = await PaymentAttempt.find({
    transactionStatus: "PENDING",
    reconciliationStatus: "IN_PROGRESS",
    blocksNewAttempt: true,
    updatedAt: { $lt: cutoff },
  })
    .select("_id")
    .limit(100)
    .lean();

  for (const attempt of stale) {
    await paymentQueue.add(
      "reconcile-payment-attempt",
      { attemptId: String(attempt._id) },
      {
        jobId: `recover-inprogress-${attempt._id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
      },
    );
  }
}

export async function recoverStalePaymentAttempts() {
  const cutoff = new Date(Date.now() - STARTED_TIMEOUT_MS);

  const staleAttempts = await PaymentAttempt.find({
    initiationStatus: "STARTED",
    createdAt: { $lt: cutoff },
    transactionStatus: "PENDING",
    blocksNewAttempt: true,
  })
    .select("_id")
    .limit(100)
    .lean();

  for (const attempt of staleAttempts) {
    await paymentQueue.add(
      "reconcile-payment-attempt",
      { attemptId: String(attempt._id) },
      {
        jobId: `recover-payment-${attempt._id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
      },
    );
  }
}

export async function recoverSuccessfulPaymentsWithoutConfirmedBookings() {
  const payments = await Payment.find({
    status: "SUCCEEDED",
    successfulAttemptId: { $ne: null },
  })
    .select("_id successfulAttemptId")
    .limit(100)
    .lean();

  for (const payment of payments) {
    await paymentQueue.add(
      "confirm-paid-booking",
      {
        paymentId: String(payment._id),
        attemptId: String(payment.successfulAttemptId),
      },
      {
        jobId: `recover-confirm-${payment._id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
      },
    );
  }
}

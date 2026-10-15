import { Worker } from "bullmq";

import env from "../config/env.js";

import Payment from "../models/Payment.js";
import PaymentAttempt from "../models/PaymentAttempt.js";

import { normalizePaymobTransaction } from "../services/paymob/normalize-paymob-result.js";
import { paymentQueue } from "../queues/payment-queue.js";

import { inquirePaymobTransactionByReference } from "../services/paymob/paymob-inquiry-service.js";

import {
  processPaymobTransaction,
  confirmBookingAfterPayment,
} from "../modules/payment/payment-result-service.js";

const QUEUE_NAME = "payment";
const MAX_RECONCILIATION_CHECKS = 8;
const BASE_RECONCILIATION_DELAY_MS = 60_000;
const MAX_RECONCILIATION_DELAY_MS = 30 * 60_000;

const connection = {
  url: env.redisUrl,
};

function getReconciliationDelay(checkNumber) {
  const exponent = Math.max(0, checkNumber - 1);

  return Math.min(
    BASE_RECONCILIATION_DELAY_MS * 2 ** exponent,
    MAX_RECONCILIATION_DELAY_MS,
  );
}

async function scheduleNextReconciliation(attempt) {
  const attemptId = String(attempt._id);
  const checkNumber = attempt.reconciliationAttempts;

  if (checkNumber >= MAX_RECONCILIATION_CHECKS) {
    await PaymentAttempt.updateOne(
      {
        _id: attempt._id,
        transactionStatus: "PENDING",
        blocksNewAttempt: true,
        reconciliationStatus: "PENDING",
      },
      {
        $set: {
          reconciliationStatus: "MANUAL_REVIEW",
          blocksNewAttempt: true,
          lastReconciledAt: new Date(),
          failureReason:
            "Payment status remained unresolved after reconciliation checks",
        },
      },
    );

    return {
      status: "MANUAL_REVIEW",
      attemptId,
    };
  }

  const delay = getReconciliationDelay(checkNumber);
  const nextCheck = checkNumber + 1;

  // Make the attempt eligible for recovery if adding the job fails.
  await PaymentAttempt.updateOne(
    {
      _id: attempt._id,
      transactionStatus: "PENDING",
      blocksNewAttempt: true,
      reconciliationStatus: "IN_PROGRESS",
    },
    {
      $set: {
        reconciliationStatus: "PENDING",
        lastReconciledAt: new Date(),
      },
    },
  );

  await paymentQueue.add(
    "reconcile-payment-attempt",
    { attemptId },
    {
      jobId: `reconcile-payment-${attemptId}-check-${nextCheck}`,
      delay,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
      removeOnComplete: 1_000,
      removeOnFail: 5_000,
    },
  );

  return {
    status: "RECONCILIATION_SCHEDULED",
    attemptId,
    nextCheck,
    delay,
  };
}

async function reconcilePaymentAttempt({ attemptId }) {
  // Claim only a PENDING attempt. This prevents two workers from
  // intentionally reconciling the same attempt at the same time.
  const attempt = await PaymentAttempt.findOneAndUpdate(
    {
      _id: attemptId,
      transactionStatus: "PENDING",
      blocksNewAttempt: true,
      reconciliationStatus: "PENDING",
    },
    {
      $set: {
        reconciliationStatus: "IN_PROGRESS",
      },
      $inc: {
        reconciliationAttempts: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!attempt) {
    const current = await PaymentAttempt.findById(attemptId)
      .select("transactionStatus reconciliationStatus blocksNewAttempt")
      .lean();

    if (!current) {
      return { status: "ATTEMPT_NOT_FOUND" };
    }

    if (
      current.transactionStatus !== "PENDING" ||
      current.reconciliationStatus === "RESOLVED" ||
      current.reconciliationStatus === "MANUAL_REVIEW" ||
      current.blocksNewAttempt === false
    ) {
      return { status: "NO_RECONCILIATION_NEEDED" };
    }

    // IN_PROGRESS can mean another worker owns it, or a previous
    // process crashed. Recovery logic must reset stale claims.
    return { status: "ATTEMPT_NOT_CLAIMED" };
  }

  try {
    const rawTransaction = await inquirePaymobTransactionByReference(
      attempt.specialReference,
    );

    const transaction = normalizePaymobTransaction(rawTransaction);

    // Do not trust the inquiry result merely because it was returned
    // by HTTP. The result service must check the order, amount, currency,
    // transaction ID, and final payment status before recording success.
    const result = await processPaymobTransaction({
      attemptId: attempt._id,
      transaction,
    });

    await PaymentAttempt.updateOne(
      { _id: attempt._id },
      {
        $set: {
          lastReconciledAt: new Date(),
        },
      },
    );

    if (result.status === "PENDING") {
      // The result service should leave unresolved transactions in
      // reconciliationStatus=PENDING and keep blocksNewAttempt=true.
      const refreshed = await PaymentAttempt.findById(attempt._id)
        .select(
          "reconciliationAttempts reconciliationStatus transactionStatus blocksNewAttempt",
        )
        .lean();

      if (
        !refreshed ||
        refreshed.transactionStatus !== "PENDING" ||
        refreshed.blocksNewAttempt !== true
      ) {
        return {
          status: "STATE_CHANGED",
          result,
        };
      }

      if (refreshed.reconciliationStatus === "MANUAL_REVIEW") {
        return {
          status: "MANUAL_REVIEW",
          result,
        };
      }

      // Some result-service implementations leave this state as
      // IN_PROGRESS; normalize it before scheduling the next check.
      if (refreshed.reconciliationStatus === "IN_PROGRESS") {
        await PaymentAttempt.updateOne(
          {
            _id: attempt._id,
            reconciliationStatus: "IN_PROGRESS",
            transactionStatus: "PENDING",
          },
          {
            $set: {
              reconciliationStatus: "PENDING",
            },
          },
        );
      }

      const readyToSchedule = await PaymentAttempt.findOne({
        _id: attempt._id,
        transactionStatus: "PENDING",
        blocksNewAttempt: true,
        reconciliationStatus: "PENDING",
      })
        .select("_id reconciliationAttempts")
        .lean();

      if (!readyToSchedule) {
        return {
          status: "STATE_CHANGED",
          result,
        };
      }

      return scheduleNextReconciliation(readyToSchedule);
    }

    // A final result is only trusted if the result service has
    // validated it and committed the state transition.
    return result;
  } catch (error) {
    if (error.retryable === false) {
      await PaymentAttempt.updateOne(
        {
          _id: attempt._id,
          transactionStatus: "PENDING",
          reconciliationStatus: "IN_PROGRESS",
        },
        {
          $set: {
            reconciliationStatus: "MANUAL_REVIEW",
            lastReconciledAt: new Date(),
            failureReason: String(error.message).slice(0, 500),
            blocksNewAttempt: true,
          },
        },
      );

      // This is an inquiry/configuration problem, not proof
      // that the customer's payment failed.
      return { status: "MANUAL_REVIEW" };
    }

    await PaymentAttempt.updateOne(
      {
        _id: attempt._id,
        transactionStatus: "PENDING",
        reconciliationStatus: "IN_PROGRESS",
      },
      {
        $set: {
          reconciliationStatus: "PENDING",
          lastReconciledAt: new Date(),
        },
      },
    );

    throw error;
  }
}

async function confirmPaidBooking({ paymentId, attemptId }) {
  const payment = await Payment.findById(paymentId)
    .select("_id status successfulAttemptId")
    .lean();

  if (!payment) {
    return { status: "PAYMENT_NOT_FOUND" };
  }

  if (payment.status !== "SUCCEEDED") {
    return { status: "PAYMENT_NOT_SUCCEEDED" };
  }

  if (String(payment.successfulAttemptId) !== String(attemptId)) {
    // Never confirm a booking using an attempt other than the one
    // atomically recorded as the successful attempt.
    return { status: "ATTEMPT_MISMATCH" };
  }

  return confirmBookingAfterPayment({
    paymentId,
    attemptId,
  });
}

export const paymentWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    switch (job.name) {
      case "reconcile-payment-attempt":
        return reconcilePaymentAttempt({
          attemptId: job.data.attemptId,
        });

      case "confirm-paid-booking":
        return confirmPaidBooking({
          paymentId: job.data.paymentId,
          attemptId: job.data.attemptId,
        });

      default:
        throw new Error(`Unknown payment job: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 5,
  },
);

paymentWorker.on("completed", (job, result) => {
  console.info("Payment job completed", {
    jobId: job.id,
    jobName: job.name,
    resultStatus: result?.status ?? "COMPLETED",
  });
});

paymentWorker.on("failed", async (job, error) => {
  console.error("Payment job failed", {
    jobId: job?.id,
    jobName: job?.name,
    attemptId: job?.data?.attemptId,
    paymentId: job?.data?.paymentId,
    attemptsMade: job?.attemptsMade,
    error: error.message,
  });

  if (!job) return;

  const maxAttempts = job.opts.attempts ?? 1;
  const retriesExhausted = job.attemptsMade >= maxAttempts;

  if (job.name === "reconcile-payment-attempt" && retriesExhausted) {
    // Do not mark the payment FAILED just because inquiry failed.
    // Leave it eligible for the recovery scanner.
    await PaymentAttempt.updateOne(
      {
        _id: job.data.attemptId,
        transactionStatus: "PENDING",
        blocksNewAttempt: true,
        reconciliationStatus: "IN_PROGRESS",
      },
      {
        $set: {
          reconciliationStatus: "PENDING",
          lastReconciledAt: new Date(),
        },
      },
    ).catch((updateError) => {
      console.error("Could not reset reconciliation state", {
        attemptId: job.data.attemptId,
        error: updateError.message,
      });
    });
  }
});

paymentWorker.on("error", (error) => {
  console.error("Payment worker runtime error", {
    error: error.message,
  });
});

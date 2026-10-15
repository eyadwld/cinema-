import mongoose from "mongoose";
import crypto from "crypto";
import Payment from "../../models/Payment.js";
import Booking from "../../models/Booking.js";
import PaymentAttempt from "../../models/PaymentAttempt.js";
import OutboxEvent from "../../models/OutboxEvent.js";
import AppError from "../../utils/appError.js";
import { createPaymobIntention } from "../../services/paymob/paymob-service.js";
import { buildPaymobCheckoutUrl } from "../../services/paymob/paymob-service.js";

const UNKNOWN_OUTCOME_MESSAGE =
  "Payment initiation outcome is unknown. Reconciliation is required.";

async function scheduleReconciliation(attemptId, reason) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const attempt = await PaymentAttempt.findById(attemptId).session(session);

      if (!attempt) {
        throw new Error("PaymentAttempt not found");
      }

      // Never downgrade a result already confirmed by the webhook.
      if (
        attempt.transactionStatus === "SUCCEEDED" ||
        attempt.transactionStatus === "FAILED" ||
        attempt.transactionStatus === "CANCELLED"
      ) {
        return;
      }

      attempt.initiationStatus = "UNKNOWN";
      attempt.reconciliationStatus = "PENDING";
      attempt.blocksNewAttempt = true;
      attempt.failureReason = reason;

      await attempt.save({ session });

      const dedupeKey = `reconcile-attempt:${attempt._id}`;

      await OutboxEvent.updateOne(
        { dedupeKey },
        {
          $setOnInsert: {
            type: "RECONCILE_PAYMENT_ATTEMPT",
            aggregateId: attempt._id,
            payload: { attemptId: attempt._id },
            status: "PENDING",
            attempts: 0,
            dedupeKey,
          },
        },
        { upsert: true, session },
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function initiatePaymobForAttempt({
  attemptId,
  amountMinor,
  currency,
  billingData,
}) {
  const attempt = await PaymentAttempt.findById(attemptId);

  if (!attempt) {
    throw new Error("PaymentAttempt not found");
  }

  // Do not create another provider request for an existing attempt.
  if (attempt.initiationStatus !== "STARTED") {
    return {
      status: attempt.initiationStatus,
      attemptId: String(attempt._id),
    };
  }

  let intention;

  // Stage 1: make the external request.
  // Keep this try/catch separate from the database write below.
  try {
    intention = await createPaymobIntention({
      amountMinor,
      currency,
      billingData,
      specialReference: attempt.specialReference,
    });
  } catch (error) {
    if (error.outcomeUnknown === true) {
      await scheduleReconciliation(
        attempt._id,
        "Paymob creation response was ambiguous or unavailable",
      );

      return {
        status: "UNKNOWN",
        attemptId: String(attempt._id),
        message: UNKNOWN_OUTCOME_MESSAGE,
      };
    }

    // Only use this branch for a rejection that is known to mean
    // Paymob did not create the intention.
    //
    // Do not classify every HTTP 4xx response as definitive without
    // checking Paymob's actual response and documented error semantics.
    throw error;
  }

  // Stage 2: persist the successful provider response.
  // If this write fails, do NOT send another intention request.
  try {
    const saved = await PaymentAttempt.findOneAndUpdate(
      {
        _id: attempt._id,
        initiationStatus: "STARTED",
      },
      {
        $set: {
          initiationStatus: "CREATED",
          providerIntentionId: String(
            intention.intentionId ?? intention.id,
          ),
          providerOrderId: String(intention.orderId),
          checkoutClientSecret: intention.clientSecret,
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!saved) {
      // A webhook or another process may have changed the attempt.
      // Read the latest state rather than overwriting it.
      const latest = await PaymentAttempt.findById(attempt._id);

      if (latest?.providerOrderId && latest?.providerIntentionId) {
        return {
          status: latest.initiationStatus,
          attemptId: String(latest._id),
        };
      }

      await scheduleReconciliation(
        attempt._id,
        "Provider responded successfully but attempt state changed",
      );

      return {
        status: "UNKNOWN",
        attemptId: String(attempt._id),
        message: UNKNOWN_OUTCOME_MESSAGE,
      };
    }

    return {
      status: "CREATED",
      attemptId: String(saved._id),
      checkoutUrl: buildPaymobCheckoutUrl(saved.checkoutClientSecret),
    };
  } catch (error) {
    // Paymob may already have created the intention.
    // The database write failure does not undo that external action.
    //
    // Best effort: record uncertainty and enqueue reconciliation.
    // If MongoDB itself is unavailable, this can fail too; the
    // stale-STARTED recovery scanner described below is essential.
    try {
      await scheduleReconciliation(
        attempt._id,
        "Paymob intention may exist, but saving its response failed",
      );
    } catch {
      // Do not hide the original persistence error.
      // A recovery scanner must find this stale STARTED attempt.
    }

    throw error;
  }
}

export async function initiateBookingPayment({
  userId,
  bookingId,
  idempotencyKey,
  billingData,
}) {
  if (
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(bookingId)
  ) {
    throw new AppError("Invalid user or booking ID", 400);
  }

  if (
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim() ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError("Idempotency-Key header is required", 400);
  }

  if (
    billingData !== undefined &&
    (typeof billingData !== "object" ||
      billingData === null ||
      Array.isArray(billingData))
  ) {
    throw new AppError("Invalid billing data", 400);
  }

  const key = idempotencyKey.trim();

  const booking = await Booking.findOne({
    _id: bookingId,
    userId,
  }).lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  if (booking.status !== "PENDING_PAYMENT") {
    throw new AppError("Booking is no longer payable", 409);
  }

  if (booking.expiresAt <= new Date()) {
    throw new AppError("Booking has expired", 410);
  }

  let payment = await Payment.findOne({
    bookingId: booking._id,
  });

  if (!payment) {
    try {
      const created = await Payment.create({
        bookingId: booking._id,
        userId: booking.userId,
        provider: "PAYMOB",
        status: "PENDING",
        amountMinor: booking.totalAmountMinor,
        currency: booking.currency,
      });

      payment = created;
    } catch (error) {
      if (error?.code === 11000) {
        payment = await Payment.findOne({
          bookingId: booking._id,
        });

        if (!payment) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  if (String(payment.userId) !== String(userId)) {
    throw new AppError("Booking does not belong to you", 403);
  }

  if (payment.status === "SUCCEEDED") {
    throw new AppError("Payment has already succeeded", 409);
  }

  if (
    Number(payment.amountMinor) !== Number(booking.totalAmountMinor) ||
    payment.currency !== booking.currency
  ) {
    throw new AppError("Payment amount mismatch", 500);
  }

  const existingByKey = await PaymentAttempt.findOne({
    userId,
    idempotencyKey: key,
  });

  if (existingByKey) {
    if (String(existingByKey.bookingId) !== String(booking._id)) {
      throw new AppError("Idempotency key already used", 409);
    }

    return initiatePaymobForAttempt({
      attemptId: existingByKey._id,
      amountMinor: existingByKey.amountMinor,
      currency: existingByKey.currency,
      billingData: billingData ?? {},
    });
  }

  const blockingAttempt = await PaymentAttempt.findOne({
    bookingId: booking._id,
    blocksNewAttempt: true,
  })
    .select("_id")
    .lean();

  if (blockingAttempt) {
    throw new AppError("Another payment attempt is in progress", 409);
  }

  let attempt;

  try {
    attempt = await PaymentAttempt.create({
      paymentId: payment._id,
      bookingId: booking._id,
      userId,
      provider: "PAYMOB",
      idempotencyKey: key,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      specialReference: crypto.randomUUID(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const conflicting = await PaymentAttempt.findOne({
        userId,
        idempotencyKey: key,
      });

      if (conflicting) {
        return initiatePaymobForAttempt({
          attemptId: conflicting._id,
          amountMinor: conflicting.amountMinor,
          currency: conflicting.currency,
          billingData: billingData ?? {},
        });
      }

      throw new AppError("Another payment attempt is in progress", 409);
    }

    throw error;
  }

  try {
    return await initiatePaymobForAttempt({
      attemptId: attempt._id,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      billingData: billingData ?? {},
    });
  } catch (error) {
    if (error.outcomeUnknown !== true) {
      await PaymentAttempt.updateOne(
        {
          _id: attempt._id,
          initiationStatus: "STARTED",
        },
        {
          $set: {
            initiationStatus: "FAILED",
            transactionStatus: "FAILED",
            reconciliationStatus: "RESOLVED",
            blocksNewAttempt: false,
            failureReason: String(error.message).slice(0, 500),
          },
        },
      ).catch(() => {});
    }

    throw error;
  }
}

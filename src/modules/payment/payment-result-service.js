import mongoose from "mongoose";

import Payment from "../../models/Payment.js";
import PaymentAttempt from "../../models/PaymentAttempt.js";
import Booking from "../../models/Booking.js";
import BookingSeat from "../../models/BookingSeat.js";
import WebhookEvent from "../../models/WebhookEvent.js";
import OutboxEvent from "../../models/OutboxEvent.js";

const PROVIDER = "PAYMOB";

export class PaymentResultError extends Error {
  constructor(message, code = "PAYMENT_RESULT_ERROR") {
    super(message);
    this.name = "PaymentResultError";
    this.code = code;
  }
}

async function createOutboxEvent(
  session,
  { type, aggregateId, payload, dedupeKey },
) {
  if (!dedupeKey) {
    throw new Error("Outbox dedupeKey is required");
  }

  await OutboxEvent.updateOne(
    { dedupeKey },
    {
      $setOnInsert: {
        type,
        aggregateId,
        payload,
        dedupeKey,
        status: "PENDING",
        attempts: 0,
      },
    },
    { upsert: true, session },
  );
}

function validateTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") {
    throw new PaymentResultError("Invalid transaction data");
  }

  if (
    typeof transaction.transactionId !== "string" ||
    !transaction.transactionId.trim() ||
    typeof transaction.orderId !== "string" ||
    !transaction.orderId.trim()
  ) {
    throw new PaymentResultError(
      "Missing provider transaction ID or order ID",
      "MISSING_PROVIDER_IDENTIFIERS",
    );
  }

  if (
    !Number.isSafeInteger(transaction.amountMinor) ||
    transaction.amountMinor <= 0
  ) {
    throw new PaymentResultError("Invalid provider amount", "INVALID_AMOUNT");
  }

  if (
    typeof transaction.currency !== "string" ||
    !transaction.currency.trim()
  ) {
    throw new PaymentResultError(
      "Invalid provider currency",
      "INVALID_CURRENCY",
    );
  }

  if (
    typeof transaction.success !== "boolean" ||
    typeof transaction.pending !== "boolean" ||
    typeof transaction.errorOccurred !== "boolean"
  ) {
    throw new PaymentResultError(
      "Provider transaction status is incomplete",
      "INCOMPLETE_PROVIDER_STATUS",
    );
  }

  if (transaction.success && transaction.pending) {
    throw new PaymentResultError(
      "Inconsistent provider transaction status",
      "INCONSISTENT_PROVIDER_STATUS",
    );
  }
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function isDuplicateWebhookError(error) {
  if (!isDuplicateKey(error)) return false;

  const keys = Object.keys(error.keyPattern ?? {});

  return (
    keys.includes("eventFingerprint") ||
    String(error.message).includes("eventFingerprint")
  );
}

function isFinalSuccess(transaction) {
  return (
    transaction.success === true &&
    transaction.pending === false &&
    transaction.errorOccurred === false
  );
}

function isFinalFailure(transaction) {
  return (
    transaction.pending === false &&
    (transaction.success === false || transaction.errorOccurred === true)
  );
}

async function markManualReview({
  session,
  payment,
  attempt,
  transaction,
  reason,
  dedupeSuffix,
}) {
  attempt.providerTransactionId = transaction.transactionId;
  attempt.providerOrderId = transaction.orderId;
  attempt.reconciliationStatus = "MANUAL_REVIEW";
  attempt.blocksNewAttempt = true;
  attempt.failureReason = reason;

  if (isFinalSuccess(transaction)) {
    attempt.transactionStatus = "SUCCEEDED";
    attempt.paidAt = attempt.paidAt ?? new Date();
  } else if (transaction.pending) {
    attempt.transactionStatus = "PENDING";
  } else if (isFinalFailure(transaction)) {
    attempt.transactionStatus = "FAILED";
  }

  await attempt.save({ session });

  await createOutboxEvent(session, {
    type: "PAYMENT_RECONCILIATION_REQUIRED",
    aggregateId: payment._id,
    payload: {
      paymentId: String(payment._id),
      attemptId: String(attempt._id),
      bookingId: String(attempt.bookingId),
      reason: dedupeSuffix,
    },
    dedupeKey: `payment-review:${attempt._id}:${dedupeSuffix}`,
  });
}

/**
 * Records a trusted Paymob transaction result.
 *
 * The caller must verify webhook HMAC before calling this function.
 * Inquiry results must come from the trusted Paymob server API.
 * Browser redirects are never proof of payment.
 */
export async function processPaymobTransaction({
  attemptId,
  transaction,
  webhookEvent = null,
}) {
  validateTransaction(transaction);

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const attempt = await PaymentAttempt.findById(attemptId).session(session);

      if (!attempt) {
        throw new PaymentResultError(
          "Payment attempt not found",
          "ATTEMPT_NOT_FOUND",
        );
      }

      const payment = await Payment.findById(attempt.paymentId).session(
        session,
      );

      if (!payment) {
        throw new PaymentResultError(
          "Payment record not found",
          "PAYMENT_NOT_FOUND",
        );
      }

      if (attempt.provider !== PROVIDER || payment.provider !== PROVIDER) {
        throw new PaymentResultError(
          "Unexpected payment provider",
          "PROVIDER_MISMATCH",
        );
      }

      if (
        String(payment.bookingId) !== String(attempt.bookingId) ||
        String(payment.userId) !== String(attempt.userId)
      ) {
        throw new PaymentResultError(
          "Payment and attempt ownership mismatch",
          "OWNERSHIP_MISMATCH",
        );
      }

      // If the provider order ID was not saved, the merchant reference
      // must safely identify this attempt.
      if (
        transaction.merchantReference != null &&
        String(transaction.merchantReference) !==
          String(attempt.specialReference)
      ) {
        throw new PaymentResultError(
          "Merchant reference does not match this attempt",
          "REFERENCE_MISMATCH",
        );
      }

      if (
        !attempt.providerOrderId &&
        String(transaction.merchantReference ?? "") !==
          String(attempt.specialReference)
      ) {
        throw new PaymentResultError(
          "Cannot safely associate transaction with this attempt",
          "REFERENCE_REQUIRED",
        );
      }

      if (
        attempt.providerOrderId &&
        String(attempt.providerOrderId) !== String(transaction.orderId)
      ) {
        throw new PaymentResultError(
          "Provider order ID does not match this attempt",
          "ORDER_MISMATCH",
        );
      }

      if (
        Number(attempt.amountMinor) !== transaction.amountMinor ||
        Number(payment.amountMinor) !== transaction.amountMinor
      ) {
        throw new PaymentResultError(
          "Provider amount does not match our records",
          "AMOUNT_MISMATCH",
        );
      }

      if (
        attempt.currency !== transaction.currency ||
        payment.currency !== transaction.currency
      ) {
        throw new PaymentResultError(
          "Provider currency does not match our records",
          "CURRENCY_MISMATCH",
        );
      }

      if (
        webhookEvent &&
        (typeof webhookEvent.fingerprint !== "string" ||
          !webhookEvent.fingerprint.trim())
      ) {
        throw new PaymentResultError(
          "Invalid webhook fingerprint",
          "INVALID_WEBHOOK_FINGERPRINT",
        );
      }

      const existingTransaction = await PaymentAttempt.findOne({
        provider: PROVIDER,
        providerTransactionId: transaction.transactionId,
        _id: { $ne: attempt._id },
      })
        .select("_id")
        .session(session)
        .lean();

      if (existingTransaction) {
        throw new PaymentResultError(
          "Provider transaction is linked to another attempt",
          "TRANSACTION_ALREADY_LINKED",
        );
      }

      // Save a compact audit record, not the complete provider payload.
      // The unique fingerprint index prevents exact duplicate event records.
      if (webhookEvent) {
        await WebhookEvent.create(
          [
            {
              provider: PROVIDER,
              // This is our internal fingerprint, not a Paymob event ID.
              eventId: webhookEvent.fingerprint,
              eventFingerprint: webhookEvent.fingerprint,
              eventType: webhookEvent.eventType ?? "TRANSACTION_UPDATE",
              paymentId: payment._id,
              paymentAttemptId: attempt._id,
              payload: {
                transactionId: transaction.transactionId,
                orderId: transaction.orderId,
                amountMinor: transaction.amountMinor,
                currency: transaction.currency,
                success: transaction.success,
                pending: transaction.pending,
                errorOccurred: transaction.errorOccurred,
                isVoided: Boolean(transaction.isVoided),
                isRefunded: Boolean(transaction.isRefunded),
              },
            },
          ],
          { session },
        );
      }

      // Refunds and voids need a dedicated reconciliation workflow.
      if (transaction.isVoided === true || transaction.isRefunded === true) {
        await markManualReview({
          session,
          payment,
          attempt,
          transaction,
          reason: "Void/refund requires payment reconciliation",
          dedupeSuffix: "VOID_OR_REFUND_STATE",
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      const paymentAlreadySucceeded = payment.status === "SUCCEEDED";

      const thisAttemptWon =
        String(payment.successfulAttemptId ?? "") === String(attempt._id);

      // A delayed notification must never downgrade the winning attempt.
      if (paymentAlreadySucceeded && thisAttemptWon) {
        if (isFinalSuccess(transaction)) {
          attempt.providerTransactionId = transaction.transactionId;
          attempt.providerOrderId = transaction.orderId;
          attempt.initiationStatus = "CREATED";
          attempt.transactionStatus = "SUCCEEDED";
          attempt.paidAt = attempt.paidAt ?? payment.paidAt ?? new Date();
          attempt.reconciliationStatus = "RESOLVED";
          attempt.blocksNewAttempt = false;
          attempt.failureReason = null;

          await attempt.save({ session });
        }

        result = { status: "ALREADY_PROCESSED" };
        return;
      }

      // Another attempt already won the logical Payment.
      if (paymentAlreadySucceeded && !thisAttemptWon) {
        if (transaction.pending) {
          attempt.providerTransactionId = transaction.transactionId;
          attempt.providerOrderId = transaction.orderId;
          attempt.initiationStatus = attempt.providerIntentionId
            ? "CREATED"
            : attempt.initiationStatus;
          attempt.transactionStatus = "PENDING";
          attempt.reconciliationStatus = "PENDING";
          attempt.blocksNewAttempt = true;

          await attempt.save({ session });

          await createOutboxEvent(session, {
            type: "RECONCILE_PAYMENT_ATTEMPT",
            aggregateId: attempt._id,
            payload: { attemptId: String(attempt._id) },
            dedupeKey: `reconcile-attempt:${attempt._id}:${transaction.transactionId}`,
          });

          result = { status: "PENDING" };
          return;
        }

        if (isFinalSuccess(transaction)) {
          await markManualReview({
            session,
            payment,
            attempt,
            transaction,
            reason: "Another payment attempt already succeeded",
            dedupeSuffix: "MULTIPLE_SUCCESSFUL_ATTEMPTS",
          });

          result = { status: "MANUAL_REVIEW" };
          return;
        }

        if (isFinalFailure(transaction)) {
          attempt.providerTransactionId = transaction.transactionId;
          attempt.providerOrderId = transaction.orderId;
          attempt.transactionStatus = "FAILED";
          attempt.reconciliationStatus = "RESOLVED";
          attempt.blocksNewAttempt = false;
          attempt.failureReason = "Paymob reported an unsuccessful transaction";

          await attempt.save({ session });

          result = { status: "PAYMENT_FAILED" };
          return;
        }

        await markManualReview({
          session,
          payment,
          attempt,
          transaction,
          reason: "Unrecognized state after another attempt succeeded",
          dedupeSuffix: "UNRECOGNIZED_STATE_AFTER_PAYMENT",
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      if (transaction.pending) {
        attempt.providerTransactionId = transaction.transactionId;
        attempt.providerOrderId = transaction.orderId;
        attempt.initiationStatus = attempt.providerIntentionId
          ? "CREATED"
          : attempt.initiationStatus;
        attempt.transactionStatus = "PENDING";
        attempt.reconciliationStatus = "PENDING";
        attempt.blocksNewAttempt = true;
        attempt.failureReason = null;

        await attempt.save({ session });

        await createOutboxEvent(session, {
          type: "RECONCILE_PAYMENT_ATTEMPT",
          aggregateId: attempt._id,
          payload: { attemptId: String(attempt._id) },
          dedupeKey: `reconcile-attempt:${attempt._id}:${transaction.transactionId}`,
        });

        result = { status: "PENDING" };
        return;
      }

      if (isFinalFailure(transaction)) {
        attempt.providerTransactionId = transaction.transactionId;
        attempt.providerOrderId = transaction.orderId;
        attempt.transactionStatus = "FAILED";
        attempt.reconciliationStatus = "RESOLVED";
        attempt.blocksNewAttempt = false;
        attempt.failureReason = "Paymob reported an unsuccessful transaction";

        await attempt.save({ session });

        // Payment stays PENDING. The initiation service must still verify
        // booking status and expiry before permitting another attempt.
        result = { status: "PAYMENT_FAILED" };
        return;
      }

      if (!isFinalSuccess(transaction)) {
        await markManualReview({
          session,
          payment,
          attempt,
          transaction,
          reason: "Unrecognized Paymob transaction state",
          dedupeSuffix: "UNRECOGNIZED_TRANSACTION_STATE",
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      attempt.providerTransactionId = transaction.transactionId;
      attempt.providerOrderId = transaction.orderId;
      attempt.initiationStatus = "CREATED";
      attempt.transactionStatus = "SUCCEEDED";
      attempt.paidAt = attempt.paidAt ?? new Date();
      attempt.reconciliationStatus = "RESOLVED";
      attempt.blocksNewAttempt = false;
      attempt.failureReason = null;

      await attempt.save({ session });

      // Only one attempt can win the logical Payment.
      const claimedPayment = await Payment.findOneAndUpdate(
        {
          _id: payment._id,
          status: "PENDING",
          successfulAttemptId: null,
        },
        {
          $set: {
            status: "SUCCEEDED",
            successfulAttemptId: attempt._id,
            paidAt: new Date(),
          },
        },
        { returnDocument: "after", session },
      );

      if (!claimedPayment) {
        throw new PaymentResultError(
          "Payment state changed concurrently; retry processing",
          "PAYMENT_STATE_CONFLICT",
        );
      }

      // Booking confirmation happens asynchronously through the outbox.
      await createOutboxEvent(session, {
        type: "CONFIRM_PAID_BOOKING",
        aggregateId: payment._id,
        payload: {
          paymentId: String(payment._id),
          attemptId: String(attempt._id),
        },
        dedupeKey: `confirm-booking:${attempt._id}`,
      });

      result = { status: "PAYMENT_RECORDED" };
    });

    return result;
  } catch (error) {
    if (isDuplicateWebhookError(error)) {
      return { status: "DUPLICATE_WEBHOOK" };
    }

    if (isDuplicateKey(error)) {
      throw new PaymentResultError(
        "Payment uniqueness constraint conflict; reconcile this attempt",
        "PAYMENT_UNIQUE_CONSTRAINT_CONFLICT",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Confirms the booking after a successful Payment has been persisted.
 * Inconsistent or ineligible bookings are sent to reconciliation.
 */
export async function confirmBookingAfterPayment({ paymentId, attemptId }) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentId).session(session);
      const attempt = await PaymentAttempt.findById(attemptId).session(session);

      if (!payment || !attempt) {
        result = { status: "PAYMENT_OR_ATTEMPT_NOT_FOUND" };
        return;
      }

      if (
        payment.provider !== PROVIDER ||
        attempt.provider !== PROVIDER ||
        payment.status !== "SUCCEEDED" ||
        String(payment.successfulAttemptId ?? "") !== String(attempt._id) ||
        String(payment._id) !== String(attempt.paymentId)
      ) {
        result = { status: "PAYMENT_ATTEMPT_MISMATCH" };
        return;
      }

      const booking = await Booking.findById(payment.bookingId).session(
        session,
      );

      if (!booking) {
        attempt.reconciliationStatus = "MANUAL_REVIEW";
        attempt.blocksNewAttempt = true;
        attempt.failureReason = "Booking missing after successful payment";

        await attempt.save({ session });

        await createOutboxEvent(session, {
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: String(payment._id),
            attemptId: String(attempt._id),
            reason: "BOOKING_NOT_FOUND_AFTER_PAYMENT",
          },
          dedupeKey: `payment-review:${attempt._id}:BOOKING_NOT_FOUND_AFTER_PAYMENT`,
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      if (booking.status === "CONFIRMED") {
        result = { status: "ALREADY_CONFIRMED" };
        return;
      }

      const now = new Date();

      const bookingStillEligible =
        booking.status === "PENDING_PAYMENT" &&
        booking.expiresAt instanceof Date &&
        booking.expiresAt > now;

      if (!bookingStillEligible) {
        attempt.reconciliationStatus = "MANUAL_REVIEW";
        attempt.blocksNewAttempt = true;
        attempt.failureReason =
          "Payment succeeded after booking became ineligible";

        await attempt.save({ session });

        await createOutboxEvent(session, {
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: String(payment._id),
            attemptId: String(attempt._id),
            bookingId: String(booking._id),
            bookingStatus: booking.status,
            reason: "PAYMENT_SUCCEEDED_BUT_BOOKING_INELIGIBLE",
          },
          dedupeKey: `payment-review:${attempt._id}:PAYMENT_SUCCEEDED_BUT_BOOKING_INELIGIBLE`,
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      if (!Array.isArray(booking.seatIds) || booking.seatIds.length === 0) {
        attempt.reconciliationStatus = "MANUAL_REVIEW";
        attempt.blocksNewAttempt = true;
        attempt.failureReason = "Booking has no reserved seats";

        await attempt.save({ session });

        await createOutboxEvent(session, {
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: String(payment._id),
            attemptId: String(attempt._id),
            bookingId: String(booking._id),
            reason: "BOOKING_SEATS_NOT_AVAILABLE",
          },
          dedupeKey: `payment-review:${attempt._id}:BOOKING_SEATS_NOT_AVAILABLE`,
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      // Assumes BookingSeat has bookingId, showtimeId and seatId fields.
      const seatCount = await BookingSeat.countDocuments({
        bookingId: booking._id,
        showtimeId: booking.showtimeId,
        seatId: { $in: booking.seatIds },
      }).session(session);

      if (seatCount !== booking.seatIds.length) {
        attempt.reconciliationStatus = "MANUAL_REVIEW";
        attempt.blocksNewAttempt = true;
        attempt.failureReason =
          "Payment succeeded but booking seats are no longer reserved";

        await attempt.save({ session });

        await createOutboxEvent(session, {
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: String(payment._id),
            attemptId: String(attempt._id),
            bookingId: String(booking._id),
            reason: "BOOKING_SEATS_NOT_AVAILABLE",
          },
          dedupeKey: `payment-review:${attempt._id}:BOOKING_SEATS_NOT_AVAILABLE`,
        });

        result = { status: "MANUAL_REVIEW" };
        return;
      }

      const confirmedBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: "PENDING_PAYMENT",
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "CONFIRMED",
            confirmedAt: now,
          },
        },
        { returnDocument: "after", session },
      );

      if (!confirmedBooking) {
        throw new PaymentResultError(
          "Booking state changed concurrently; retry confirmation",
          "BOOKING_STATE_CONFLICT",
        );
      }

      await createOutboxEvent(session, {
        type: "BOOKING_CONFIRMATION",
        aggregateId: booking._id,
        payload: {
          bookingId: String(booking._id),
          userId: String(booking.userId),
        },
        dedupeKey: `booking-confirmation:${booking._id}`,
      });

      result = { status: "BOOKING_CONFIRMED" };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import Payment from "../../models/Payment.js";
import WebhookEvent from "../../models/WebhookEvent.js";

export const processPaymobTransaction = async (obj) => {
  if (
    obj?.id == null ||
    obj?.order?.id == null ||
    typeof obj.success !== "boolean" ||
    typeof obj.pending !== "boolean"
  ) {
    return { ignored: true, reason: "Invalid transaction payload" };
  }

  const eventId = String(obj.id);
  const providerOrderId = String(obj.order.id);

  const session = await mongoose.startSession();

  try {
    let outcome = { processed: false };

    await session.withTransaction(async () => {
      const payment = await Payment.findOne({
        provider: "PAYMOB",
        providerOrderId,
      }).session(session);

      if (!payment) {
        // A valid provider callback can arrive for an unknown
        // local order. Do not update any payment or booking.
        outcome = {
          processed: false,
          reason: "Payment not found",
        };
        return;
      }

      // Validate financial data before changing state.
      if (
        Number(obj.amount_cents) !== payment.amountMinor ||
        obj.currency !== payment.currency
      ) {
        outcome = {
          processed: false,
          reason: "Amount or currency mismatch",
        };
        return;
      }

      await WebhookEvent.create(
        [
          {
            provider: "PAYMOB",
            eventId,
            eventType: "TRANSACTION",
            paymentId: payment._id,
          },
        ],
        { session },
      );

      // Repeated or late events must not downgrade a successful
      // payment or confirm the booking twice.
      if (payment.status === "SUCCEEDED") {
        outcome = {
          processed: true,
          duplicateState: true,
        };
        return;
      }

      // This version models one terminal transaction per local
      // Payment attempt. Multi-attempt intentions need a separate
      // transaction/attempt model.
      if (payment.status !== "PENDING") {
        outcome = {
          processed: true,
          terminalStateAlreadySet: true,
        };
        return;
      }

      const transactionSucceeded =
        obj.success === true &&
        obj.pending === false &&
        obj.error_occured === false &&
        obj.is_voided !== true &&
        obj.is_refunded !== true;

      if (!transactionSucceeded) {
        payment.status = "FAILED";
        payment.blocksNewAttempt = false;
        payment.failureReason = "Paymob transaction was not successful";

        await payment.save({ session });

        outcome = { processed: true, paymentSucceeded: false };
        return;
      }

      payment.status = "SUCCEEDED";
      payment.providerTransactionId = eventId;
      payment.paidAt = new Date();
      payment.blocksNewAttempt = false;
      payment.failureReason = null;

      await payment.save({ session });

      const now = new Date();

      // Compare-and-set: only confirm an eligible booking.
      const confirmedBooking = await Booking.findOneAndUpdate(
        {
          _id: payment.bookingId,
          userId: payment.userId,
          status: "PENDING_PAYMENT",
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "CONFIRMED",
            confirmedAt: now,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!confirmedBooking) {
        // Money was paid, but the booking is no longer eligible
        // for confirmation. This requires reconciliation/refund
        // handling; never pretend the payment failed.
        payment.failureReason =
          "PAID_BUT_BOOKING_NOT_CONFIRMABLE_REQUIRES_RECONCILIATION";

        await payment.save({ session });

        outcome = {
          processed: true,
          paymentSucceeded: true,
          bookingConfirmed: false,
          reconciliationRequired: true,
        };

        return;
      }

      outcome = {
        processed: true,
        paymentSucceeded: true,
        bookingConfirmed: true,
      };
    });

    return outcome;
  } finally {
    await session.endSession();
  }
};

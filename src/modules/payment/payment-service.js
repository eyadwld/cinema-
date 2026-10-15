import mongoose from "mongoose";

import Booking from "../../models/Booking.js";
import OutboxEvent from "../../models/OutboxEvent.js";
import Payment from "../../models/Payment.js";
import PaymentAttempt from "../../models/PaymentAttempt.js";
import User from "../../models/User.js";
import WebhookEvent from "../../models/WebhookEvent.js";
import env from "../../config/env.js";
import AppError from "../../utils/appError.js";
import { error as logError, info as logInfo } from "../../utils/logger.js";
import {
  buildCheckoutUrl,
  createIntention,
  retrieveIntention,
} from "./paymob-client.js";
import {
  buildEventFingerprint,
  isSuccessfulTransaction,
  verifyPaymobHmac,
} from "./paymob-hmac.js";
import { buildIntentionPayload } from "./paymob-service.js";

const assertBookingAccess = async (booking, userId) => {
  if (String(booking.userId) === String(userId)) {
    return;
  }

  const user = await User.findById(userId).select("role").lean();

  if (!user || user.role !== "ADMIN") {
    throw new AppError("Booking not found", 404);
  }
};

const toPublicPayment = (payment, attempt, { reused = false } = {}) => ({
  paymentId: payment._id.toString(),
  bookingId: payment.bookingId.toString(),
  amountMinor: payment.amountMinor,
  currency: payment.currency,
  status: payment.status,
  checkoutUrl: payment.checkoutUrl,
  attemptId: attempt._id.toString(),
  attemptStatus: attempt.status,
  reused,
});

export const initiatePayment = async ({
  bookingId,
  userId,
  idempotencyKey,
}) => {
  if (
    !mongoose.isValidObjectId(bookingId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new AppError("Invalid booking or user ID", 400);
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length === 0
  ) {
    throw new AppError("Idempotency-Key header is required", 400);
  }

  const key = idempotencyKey.trim();

  const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey: key });

  if (existingAttempt) {
    if (
      String(existingAttempt.bookingId) !== String(bookingId) ||
      String(existingAttempt.userId) !== String(userId)
    ) {
      throw new AppError(
        "Idempotency key already used for another booking",
        409,
      );
    }

    const payment = await Payment.findById(existingAttempt.paymentId);

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return {
      ...toPublicPayment(payment, existingAttempt, { reused: true }),
      idempotencyKey: key,
    };
  }

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  await assertBookingAccess(booking, userId);

  if (booking.status !== "PENDING_PAYMENT") {
    throw new AppError(`Booking is ${booking.status} and cannot be paid`, 409);
  }

  if (booking.expiresAt <= new Date()) {
    throw new AppError("Booking has expired", 410);
  }

  const session = await mongoose.startSession();
  let payment;
  let attempt;

  try {
    await session.withTransaction(async () => {
      payment = await Payment.findOne({ bookingId: booking._id }).session(
        session,
      );

      if (payment && payment.status === "SUCCESS") {
        throw new AppError("Booking is already paid", 409);
      }

      if (!payment) {
        [payment] = await Payment.create(
          [
            {
              bookingId: booking._id,
              userId: booking.userId,
              showtimeId: booking.showtimeId,
              amountMinor: booking.totalAmountMinor,
              currency: booking.currency,
              status: "PENDING",
            },
          ],
          { session },
        );
      } else if (payment.status === "FAILED") {
        payment.status = "PENDING";
        payment.amountMinor = booking.totalAmountMinor;
        await payment.save({ session });
      }

      [attempt] = await PaymentAttempt.create(
        [
          {
            paymentId: payment._id,
            bookingId: booking._id,
            userId,
            idempotencyKey: key,
            status: "INITIATED",
            amountMinor: booking.totalAmountMinor,
          },
        ],
        { session },
      );

      await OutboxEvent.create(
        [
          {
            type: "RECONCILE_PAYMENT_ATTEMPT",
            aggregateId: attempt._id,
            payload: {
              attemptId: attempt._id.toString(),
              paymentId: payment._id.toString(),
              bookingId: booking._id.toString(),
            },
            status: "PENDING",
            attempts: 0,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      const raced = await PaymentAttempt.findOne({ idempotencyKey: key });
      const racedPayment = raced
        ? await Payment.findById(raced.paymentId)
        : null;

      if (raced && racedPayment) {
        return {
          ...toPublicPayment(racedPayment, raced, { reused: true }),
          idempotencyKey: key,
        };
      }

      throw new AppError("Duplicate payment attempt", 409);
    }

    throw error;
  } finally {
    await session.endSession();
  }

  const user = await User.findById(userId).select("name email").lean();
  const payload = buildIntentionPayload({ booking, user, payment });

  let intention;
  try {
    intention = await createIntention(payload);
  } catch (error) {
    await PaymentAttempt.updateOne(
      { _id: attempt._id },
      { $set: { status: "FAILED", rawResponse: { error: error.message } } },
    );
    throw error;
  }

  const intentionId = intention?.id ? String(intention.id) : null;
  const orderId = Number(intention?.intention_order_id);
  const clientSecret = intention?.client_secret || null;
  const checkoutUrl = buildCheckoutUrl(clientSecret);

  await Payment.updateOne(
    { _id: payment._id },
    {
      $set: {
        paymobIntentionId: intentionId,
        paymobOrderId: Number.isSafeInteger(orderId) ? orderId : null,
        clientSecret,
        checkoutUrl,
      },
    },
  );

  await PaymentAttempt.updateOne(
    { _id: attempt._id },
    { $set: { paymobIntentionId: intentionId, rawResponse: intention } },
  );

  payment = await Payment.findById(payment._id);
  attempt = await PaymentAttempt.findById(attempt._id);

  logInfo("Payment intention created", {
    paymentId: payment._id.toString(),
    bookingId,
  });

  return {
    ...toPublicPayment(payment, attempt, { reused: false }),
    idempotencyKey: key,
    publicKey: env.paymobPublicKey,
  };
};

export const getPaymentById = async ({ paymentId, userId }) => {
  if (!mongoose.isValidObjectId(paymentId)) {
    throw new AppError("Invalid payment ID", 400);
  }

  const payment = await Payment.findById(paymentId).lean();

  if (!payment) {
    throw new AppError("Payment not found", 404);
  }

  const booking = await Booking.findById(payment.bookingId).lean();

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  await assertBookingAccess(booking, userId);

  const attempts = await PaymentAttempt.find({ paymentId: payment._id })
    .sort({ createdAt: -1 })
    .lean();

  return { payment, booking, attempts };
};

export const handlePaymobWebhook = async ({ hmac, body }) => {
  const obj = body?.obj || {};
  const eventType = body?.type || "TRANSACTION";

  if (Object.keys(obj).length > 0 && !verifyPaymobHmac(obj, hmac)) {
    throw new AppError("Invalid webhook signature", 401);
  }

  const eventId =
    obj?.id !== undefined && obj?.id !== null ? String(obj.id) : "unknown";
  const fingerprint = buildEventFingerprint(obj, body);

  let webhookEvent = null;
  try {
    [webhookEvent] = await WebhookEvent.create([
      {
        provider: "PAYMOB",
        eventId,
        eventFingerprint: fingerprint,
        eventType,
        payload: body,
      },
    ]);
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await WebhookEvent.findOne({
        provider: "PAYMOB",
        eventFingerprint: fingerprint,
      });

      if (existing?.paymentId) {
        const dedupeKey = `confirm-${existing._id}`;
        const outboxExists = await OutboxEvent.findOne({ dedupeKey }).lean();

        if (!outboxExists) {
          await OutboxEvent.create([
            {
              type: "CONFIRM_PAID_BOOKING",
              aggregateId: existing.paymentId,
              payload: {
                paymentId: existing.paymentId.toString(),
                attemptId: existing.paymentAttemptId?.toString() || null,
                webhookEventId: existing._id.toString(),
              },
              status: "PENDING",
              attempts: 0,
              dedupeKey,
            },
          ]);
        }
      }

      return { code: "ALREADY_PROCESSED", eventFingerprint: fingerprint };
    }

    throw error;
  }

  const orderId = Number(obj?.order?.id);
  const intentionRef =
    obj?.intention?.id ||
    obj?.order?.intention_id ||
    body?.intention?.id ||
    obj?.intention_id ||
    null;

  let payment = null;

  if (intentionRef) {
    payment = await Payment.findOne({
      paymobIntentionId: String(intentionRef),
    });
  }

  if (!payment && Number.isSafeInteger(orderId)) {
    payment = await Payment.findOne({ paymobOrderId: orderId });
  }

  if (!payment) {
    const merchantOrderId =
      obj?.merchant_order_id ||
      obj?.order?.merchant_order_id ||
      body?.merchant_order_id;

    if (merchantOrderId && mongoose.isValidObjectId(merchantOrderId)) {
      payment = await Payment.findOne({ bookingId: merchantOrderId });
    }
  }

  if (!payment) {
    const extraBookingId =
      obj?.payment_key_claims?.extra?.bookingId || body?.extras?.bookingId;

    if (extraBookingId && mongoose.isValidObjectId(extraBookingId)) {
      payment = await Payment.findOne({ bookingId: extraBookingId });
    }
  }

  let attempt = null;

  if (payment) {
    attempt = await PaymentAttempt.findOne({ paymentId: payment._id }).sort({
      createdAt: -1,
    });

    await WebhookEvent.updateOne(
      { _id: webhookEvent._id },
      {
        $set: {
          paymentId: payment._id,
          paymentAttemptId: attempt?._id || null,
        },
      },
    );
  }

  if (!payment) {
    logError("Paymob webhook without matching payment", { eventId, orderId });
    await WebhookEvent.updateOne(
      { _id: webhookEvent._id },
      { $set: { processedAt: new Date() } },
    );

    return { code: "NO_MATCHING_PAYMENT", eventFingerprint: fingerprint };
  }

  await OutboxEvent.create([
    {
      type: "CONFIRM_PAID_BOOKING",
      aggregateId: payment._id,
      payload: {
        paymentId: payment._id.toString(),
        attemptId: attempt?._id?.toString() || null,
        webhookEventId: webhookEvent._id.toString(),
      },
      status: "PENDING",
      attempts: 0,
      dedupeKey: `confirm-${webhookEvent._id}`,
    },
  ]);

  return {
    code: "QUEUED",
    eventFingerprint: fingerprint,
    paymentId: payment._id.toString(),
  };
};

export const confirmPaidBooking = async ({
  paymentId,
  attemptId,
  webhookEventId = null,
}) => {
  if (paymentId && !mongoose.isValidObjectId(paymentId)) {
    throw new Error("Invalid payment ID");
  }

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    throw new Error("Payment not found for confirmation");
  }

  const booking = await Booking.findById(payment.bookingId);

  if (!booking) {
    throw new Error("Booking not found for confirmation");
  }

  let webhookEvent = null;

  if (webhookEventId && mongoose.isValidObjectId(webhookEventId)) {
    webhookEvent = await WebhookEvent.findById(webhookEventId);
  }

  if (!webhookEvent) {
    webhookEvent = await WebhookEvent.findOne({ paymentId: payment._id }).sort({
      createdAt: -1,
    });
  }

  const obj = webhookEvent?.payload?.obj || {};
  const hasWebhook = Object.keys(obj).length > 0;

  let success = hasWebhook ? isSuccessfulTransaction(obj) : false;
  let transactionId =
    obj?.id !== undefined && obj?.id !== null ? String(obj.id) : null;
  let amountMatches = true;

  if (hasWebhook) {
    const paidCents = Number(obj.amount_cents);

    if (!Number.isSafeInteger(paidCents) || paidCents !== payment.amountMinor) {
      amountMatches = false;
    }

    if ((obj.currency || "EGP") !== payment.currency) {
      amountMatches = false;
    }
  } else if (payment.paymobIntentionId) {
    try {
      const intention = await retrieveIntention(payment.paymobIntentionId);
      success = intention?.status === "paid" || intention?.confirmed === true;
      const intentionAmount = Number(
        intention?.intention_detail?.amount ?? intention?.amount,
      );

      amountMatches = Number.isSafeInteger(intentionAmount)
        ? intentionAmount === payment.amountMinor
        : true;
    } catch (error) {
      logError("Reconcile retrieve failed", {
        paymentId: payment._id.toString(),
        error: error.message,
      });
      throw error;
    }
  }

  const session = await mongoose.startSession();

  const safeOutboxCreate = async (doc) => {
    try {
      await OutboxEvent.create([doc], { session });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
  };

  try {
    await session.withTransaction(async () => {
      if (!amountMatches) {
        await safeOutboxCreate({
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: payment._id.toString(),
            bookingId: booking._id.toString(),
            reason: "AMOUNT_MISMATCH",
            paidCents: obj?.amount_cents ?? null,
            expectedMinor: payment.amountMinor,
          },
          status: "PENDING",
          attempts: 0,
          dedupeKey: `mismatch-${payment._id}-${webhookEvent?._id || "nointention"}`,
        });

        if (webhookEvent && !webhookEvent.processedAt) {
          webhookEvent.processedAt = new Date();
          await webhookEvent.save({ session });
        }

        return;
      }

      if (!success) {
        const failedAttempt = attemptId
          ? await PaymentAttempt.findById(attemptId).session(session)
          : await PaymentAttempt.findOne({ paymentId: payment._id })
              .sort({ createdAt: -1 })
              .session(session);

        if (failedAttempt && failedAttempt.status === "INITIATED") {
          failedAttempt.status = "FAILED";
          failedAttempt.paymobTransactionId = transactionId;
          await failedAttempt.save({ session });
        }

        if (webhookEvent && !webhookEvent.processedAt) {
          webhookEvent.processedAt = new Date();
          await webhookEvent.save({ session });
        }

        return;
      }

      const freshBooking = await Booking.findById(booking._id).session(session);

      if (!freshBooking || freshBooking.status === "CONFIRMED") {
        if (webhookEvent && !webhookEvent.processedAt) {
          webhookEvent.processedAt = new Date();
          await webhookEvent.save({ session });
        }

        return;
      }

      if (freshBooking.status !== "PENDING_PAYMENT") {
        await safeOutboxCreate({
          type: "PAYMENT_RECONCILIATION_REQUIRED",
          aggregateId: payment._id,
          payload: {
            paymentId: payment._id.toString(),
            bookingId: booking._id.toString(),
            reason: `PAID_BUT_BOOKING_${freshBooking.status}`,
            paymobTransactionId: transactionId,
          },
          status: "PENDING",
          attempts: 0,
          dedupeKey: `paid-but-${freshBooking.status}-${payment._id}-${webhookEvent?._id || "nointention"}`,
        });

        if (webhookEvent && !webhookEvent.processedAt) {
          webhookEvent.processedAt = new Date();
          await webhookEvent.save({ session });
        }

        return;
      }

      payment.status = "SUCCESS";
      payment.confirmedAt = new Date();

      if (transactionId) {
        const orderId = Number(obj?.order?.id);
        if (Number.isSafeInteger(orderId) && !payment.paymobOrderId) {
          payment.paymobOrderId = orderId;
        }
      }

      await payment.save({ session });

      const okAttempt = attemptId
        ? await PaymentAttempt.findById(attemptId).session(session)
        : await PaymentAttempt.findOne({ paymentId: payment._id })
            .sort({ createdAt: -1 })
            .session(session);

      if (okAttempt) {
        okAttempt.status = "SUCCESS";
        if (transactionId) okAttempt.paymobTransactionId = transactionId;
        await okAttempt.save({ session });
      }

      freshBooking.status = "CONFIRMED";
      freshBooking.confirmedAt = new Date();
      await freshBooking.save({ session });

      await safeOutboxCreate({
        type: "BOOKING_CONFIRMATION",
        aggregateId: freshBooking._id,
        payload: {
          bookingId: freshBooking._id.toString(),
          userId: freshBooking.userId.toString(),
        },
        status: "PENDING",
        attempts: 0,
        dedupeKey: `booking-confirmation-${freshBooking._id}`,
      });

      if (webhookEvent && !webhookEvent.processedAt) {
        webhookEvent.processedAt = new Date();
        await webhookEvent.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }

  return { paymentId: payment._id.toString(), success, amountMatches };
};

export const reconcilePaymentAttempt = async (attemptId) => {
  if (!mongoose.isValidObjectId(attemptId)) {
    throw new Error("Invalid attempt ID");
  }

  const attempt = await PaymentAttempt.findById(attemptId);

  if (!attempt || attempt.status !== "INITIATED") {
    return { reconciled: false, reason: "NOT_INITIATED" };
  }

  const ageMs = Date.now() - new Date(attempt.createdAt).getTime();

  if (ageMs < 2 * 60 * 1000) {
    return { reconciled: false, reason: "TOO_EARLY" };
  }

  const payment = await Payment.findById(attempt.paymentId);

  if (!payment) {
    return { reconciled: false, reason: "NO_PAYMENT" };
  }

  if (!payment.paymobIntentionId) {
    return { reconciled: false, reason: "NO_INTENTION" };
  }

  const existingWebhook = await WebhookEvent.findOne({
    $or: [{ paymentAttemptId: attempt._id }, { paymentId: payment._id }],
  });

  if (existingWebhook) {
    try {
      await OutboxEvent.create([
        {
          type: "CONFIRM_PAID_BOOKING",
          aggregateId: payment._id,
          payload: {
            paymentId: payment._id.toString(),
            attemptId: attempt._id.toString(),
            webhookEventId: existingWebhook._id.toString(),
          },
          status: "PENDING",
          attempts: 0,
          dedupeKey: `confirm-${existingWebhook._id}`,
        },
      ]);
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    return { reconciled: true, reason: "WEBHOOK_FOUND" };
  }

  try {
    const intention = await retrieveIntention(payment.paymobIntentionId);

    if (intention?.status === "paid" || intention?.confirmed === true) {
      try {
        await OutboxEvent.create([
          {
            type: "PAYMENT_RECONCILIATION_REQUIRED",
            aggregateId: payment._id,
            payload: {
              paymentId: payment._id.toString(),
              attemptId: attempt._id.toString(),
              reason: "INTENTION_PAID_WITHOUT_WEBHOOK",
            },
            status: "PENDING",
            attempts: 0,
            dedupeKey: `paid-no-webhook-${attempt._id}`,
          },
        ]);
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
      }

      return { reconciled: true, reason: "PAID_WITHOUT_WEBHOOK" };
    }
  } catch (error) {
    logError("Reconcile attempt retrieve failed", {
      attemptId,
      error: error.message,
    });
    throw error;
  }

  const booking = await Booking.findById(payment.bookingId).lean();

  if (
    !booking ||
    booking.status !== "PENDING_PAYMENT" ||
    booking.expiresAt <= new Date()
  ) {
    await PaymentAttempt.updateOne(
      { _id: attempt._id },
      { $set: { status: "FAILED" } },
    );

    return { reconciled: true, reason: "BOOKING_GONE" };
  }

  return { reconciled: false, reason: "STILL_PENDING" };
};

export const markBookingPaymentsFailed = async (bookingId, session = null) => {
  await Payment.updateMany(
    { bookingId, status: "PENDING" },
    { $set: { status: "FAILED" } },
    session ? { session } : {},
  );

  await PaymentAttempt.updateMany(
    { bookingId, status: "INITIATED" },
    { $set: { status: "FAILED" } },
    session ? { session } : {},
  );
};

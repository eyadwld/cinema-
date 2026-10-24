import connectDB from "../config/db.js";
import { connectRedis } from "../config/redis.js";

import {
  processOutbox,
  recoverStuckEvents,
} from "../jobs/outbox-dispatcher.js";

import {
  recoverStalePaymentAttempts,
  recoverStaleInProgressAttempts,
  recoverSuccessfulPaymentsWithoutConfirmedBookings,
} from "../jobs/payment-recovery.js";

/*
 * The queue consumers must be registered here.
 *
 * Without them the jobs stay in the "waiting" list forever
 * and the email/booking/payment handlers never run.
 */

import emailWorker from "./email-worker.js";

import bookingExpiryWorker from "./booking-expiary-worker.js";

import paymentWorker from "./payment-reconciliation-worker.js";

import mediaWorker from "./media-worker.js";

const startWorker = async () => {
  try {
    await connectDB();
    await connectRedis();

    console.log("Worker process started");

    console.log(
      `Queue consumers ready: ${emailWorker.name}, ${bookingExpiryWorker.name}, ${paymentWorker.name}, ${mediaWorker.name}`,
    );

    setInterval(
      async () => {
        try {
          await recoverStuckEvents();

          await processOutbox();

          await recoverStalePaymentAttempts();

          await recoverStaleInProgressAttempts();

          await recoverSuccessfulPaymentsWithoutConfirmedBookings();
        } catch (error) {
          console.error("Outbox error:", error);
        }
      },

      3000,
    );
  } catch (error) {
    console.error("Worker startup failed:", error);

    process.exit(1);
  }
};

startWorker();

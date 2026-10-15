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

import "./email-worker.js";
import "./booking-expiary-worker.js";
import "./payment-reconciliation-worker.js";

const startWorker = async () => {
  try {
    await connectDB();
    await connectRedis();

    console.log("Worker process started");

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

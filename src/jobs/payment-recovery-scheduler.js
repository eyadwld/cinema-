import cron from "node-cron";
import {
  recoverStalePaymentAttempts,
  recoverSuccessfulPaymentsWithoutConfirmedBookings,
} from "./payment-recovery.js";

let running = false;

export function startPaymentRecoveryScheduler() {
  cron.schedule("* * * * *", async () => {
    // Prevent overlapping executions in this process.
    if (running) return;

    running = true;

    try {
      const attempts = await recoverStalePaymentAttempts();

      const bookings =
        await recoverSuccessfulPaymentsWithoutConfirmedBookings();

      console.info("Payment recovery completed", {
        attempts,
        bookings,
      });
    } catch (error) {
      console.error("Payment recovery failed", {
        message: error.message,
      });
    } finally {
      running = false;
    }
  });
}

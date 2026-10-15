import { Worker } from "bullmq";
import env from "../config/env.js";

import { confirmPaidBooking, reconcilePaymentAttempt } from "../modules/payment/payment-service.js";

const paymentWorker = new Worker(
  "payment",
  async (job) => {
    console.log(`Processing job ${job.id}`);

    switch (job.name) {
      case "confirm-paid-booking": {
        await confirmPaidBooking({
          paymentId: job.data.paymentId,
          attemptId: job.data.attemptId,
          webhookEventId: job.data.webhookEventId,
        });

        break;
      }

      case "reconcile-payment-attempt": {
        await reconcilePaymentAttempt(job.data.attemptId);

        break;
      }

      default:
        throw new Error(`Unknown payment job: ${job.name}`);
    }
  },
  {
    connection: {
      url: env.redisUrl,
    },
  },
);

paymentWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

paymentWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

export default paymentWorker;

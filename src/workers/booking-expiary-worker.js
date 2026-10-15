import { Worker } from "bullmq";
import env from "../config/env.js";
import { expireBooking } from "../modules/booking/booking-expiary-service.js";

export const bookingExpiryWorker = new Worker(
  "booking",
  async (job) => {
    if (job.name !== "expire-booking") {
      throw new Error(`Unknown booking job: ${job.name}`);
    }

    return expireBooking(job.data.bookingId);
  },
  {
    connection: {
      url: env.redisUrl,
    },
    concurrency: 10,
  },
);

bookingExpiryWorker.on("failed", (job, error) => {
  console.error("Booking expiry job failed", {
    jobId: job?.id,
    error: error.message,
  });
});

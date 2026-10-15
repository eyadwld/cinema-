import { Worker } from "bullmq";
import env from "../config/env.js";

import { expireBooking } from "../modules/booking/booking-expiary-service.js";

const bookingExpiryWorker = new Worker(
  "booking",
  async (job) => {
    console.log(`Processing job ${job.id}`);

    switch (job.name) {
      case "expire-booking": {
        const result = await expireBooking(job.data.bookingId);

        console.log(`Expire booking ${job.data.bookingId}:`, result);

        break;
      }

      default:
        throw new Error(`Unknown booking job: ${job.name}`);
    }
  },
  {
    connection: {
      url: env.redisUrl,
    },
  },
);

bookingExpiryWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

bookingExpiryWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

export default bookingExpiryWorker;

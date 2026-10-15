import { Queue } from "bullmq";
import env from "../config/env.js";

export const paymentQueue = new Queue("payment", {
  connection: {
    url: env.redisUrl,
  },

  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
});

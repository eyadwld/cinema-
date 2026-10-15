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
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

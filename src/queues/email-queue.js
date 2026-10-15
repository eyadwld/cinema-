import { Queue } from "bullmq";
import env from "../config/env.js";

const emailQueue = new Queue("email", {
  connection: {
    url: env.redisUrl,
  },
  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 2000,
    },

    removeOnComplete: {
      age: 60 * 60,
    },

    removeOnFail: {
      age: 24 * 60 * 60,
    },
  },
});

export default emailQueue;

import { Queue } from "bullmq";
import env from "../config/env.js";

const mediaQueue = new Queue("media", {
  connection: {
    url: env.redisUrl,
  },
  defaultJobOptions: {
    attempts: 5,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export default mediaQueue;

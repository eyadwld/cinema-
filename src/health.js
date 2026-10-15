import express from "express";
import mongoose from "mongoose";

import { redisClient } from "./config/redis.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
  });
});

router.get("/ready", async (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1;

  const redisReady = redisClient.isReady;

  const ready = mongoReady && redisReady;

  res.status(ready ? 200 : 503).json({
    success: ready,
    status: ready ? "ready" : "not_ready",
    dependencies: {
      mongodb: mongoReady ? "up" : "down",
      redis: redisReady ? "up" : "down",
    },
  });
});

export default router;

import mongoose from "mongoose";

import app from "./app.js";
import connectToDB from "./config/db.js";
import { connectRedis, redisClient } from "./config/redis.js";
import env from "./config/env.js";

const startServer = async () => {
  try {
    await connectToDB();
    await connectRedis();

    const server = app.listen(env.port, () => {
      console.log(`API running on port ${env.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {
        try {
          if (redisClient.isOpen) {
            await redisClient.quit();
          }

          await mongoose.connection.close();

          console.log("Shutdown completed");

          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);

          process.exit(1);
        }
      });
    }; // this used to gracefully shutdown the server when receiving termination signals (SIGTERM or SIGINT). It closes the server, disconnects from Redis and MongoDB, and logs the shutdown process.

    process.on("SIGTERM", () => {
      shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      shutdown("SIGINT");
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    process.exit(1);
  }
};

startServer();

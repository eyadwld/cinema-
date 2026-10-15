import { redisClient } from "../../config/redis.js";
import AppError from "../../utils/appError.js";

const MAX_ATTEMPTS = 5;

const WINDOW_SECONDS = 15 * 60;

export const checkLoginRateLimit = async (email, ip) => {
  const key = `rate:login:${email}:${ip}`;

  const attempts = await redisClient.get(key);

  if (attempts && Number(attempts) >= MAX_ATTEMPTS) {
    throw new AppError("Too many login attempts. Try again later.", 429);
  }
};

export const recordFailedLogin = async (email, ip) => {
  const key = `rate:login:${email}:${ip}`;

  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.expire(key, WINDOW_SECONDS);
  }
};

export const clearLoginAttempts = async (email, ip) => {
  const key = `rate:login:${email}:${ip}`;

  await redisClient.del(key);
};

import AppError from "../../utils/appError.js";
import { redisClient } from "../../config/redis.js";

import { generateOtp, hashOtp } from "../../utils/otp.js";

const OTP_TTL_SECONDS = 10 * 60;

const MAX_OTP_ATTEMPTS = 5;

const RESEND_COOLDOWN_SECONDS = 60;

export const createEmailVerificationOtp = async (userId) => {
  const otp = await generateOtp();
  const otpHash = await hashOtp(otp);

  const otpKey = `otp:email-verification:${userId}`;
  const attemptsKey = `otp:email-verification:attempts:${userId}`;
  const cooldownKey = `otp:email-verification:cooldown:${userId}`;

  const script = `
        local cooldownCreated = redis.call(
            "SET",
            KEYS[3],
            "1",
            "EX",
            ARGV[3],
            "NX"
        )

        if not cooldownCreated then
            return 0
        end

        redis.call(
            "SET",
            KEYS[1],
            ARGV[1],
            "EX",
            ARGV[4]
        )

        redis.call(
            "SET",
            KEYS[2],
            "0",
            "EX",
            ARGV[4]
        )

        return 1
    `;

  const result = await redisClient.eval(script, {
    keys: [otpKey, attemptsKey, cooldownKey],
    arguments: [
      otpHash,
      "0",
      String(RESEND_COOLDOWN_SECONDS),
      String(OTP_TTL_SECONDS),
    ],
  });

  if (result === 0) {
    throw new AppError("Please wait before requesting another code", 429);
  }

  return otp;
};

export const verifyEmailVerificationOtp = async ({ userId, otp }) => {
  const otpKey = `otp:email-verification:${userId}`;
  const attemptsKey = `otp:email-verification:attempts:${userId}`;

  const submittedHash = await hashOtp(otp);

  const VERIFY_OTP_SCRIPT = `
    local otpKey = KEYS[1]
    local attemptsKey = KEYS[2]

    local submittedHash = ARGV[1]
    local maxAttempts = tonumber(ARGV[2])

    local storedHash = redis.call("GET", otpKey)

    if not storedHash then
        return 0
    end

    local attempts = tonumber(
        redis.call("GET", attemptsKey) or "0"
    )

    if attempts >= maxAttempts then
        return -1
    end

    if storedHash ~= submittedHash then
        local newAttempts =
            redis.call("INCR", attemptsKey)

        if newAttempts == 1 then
            local ttl =
                redis.call("TTL", otpKey)

            if ttl > 0 then
                redis.call(
                    "EXPIRE",
                    attemptsKey,
                    ttl
               )
           end
       end

        return -2
    end

    redis.call("DEL", otpKey)
    redis.call("DEL", attemptsKey)

    return 1
    `;

  const result = await redisClient.eval(VERIFY_OTP_SCRIPT, {
    keys: [otpKey, attemptsKey],
    arguments: [submittedHash, String(MAX_OTP_ATTEMPTS)],
  });

  switch (Number(result)) {
    case 1:
      return true;

    case 0:
      throw new AppError("OTP expired or does not exist", 400);

    case -1:
      throw new AppError("Too many invalid attempts. Request a new code.", 429);

    case -2:
      throw new AppError("Invalid verification code", 400);

    default:
      throw new Error("Unexpected OTP verification result");
  }
};

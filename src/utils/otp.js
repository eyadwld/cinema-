import crypto from "crypto";
import env from "../config/env.js";

export const generateOtp = async () => {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
};

export const hashOtp = async (otp) => {
  return crypto
    .createHmac("sha256", env.otpHashSecret)
    .update(otp)
    .digest("hex");
};

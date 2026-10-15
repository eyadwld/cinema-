import { Worker } from "bullmq";
import env from "../config/env.js";

import User from "../models/User.js";

import sendVerificationEmail, {
  sendBookingConfirmationEmail,
} from "../services/email/resend-service.js";

import { createEmailVerificationOtp } from "../modules/auth/otp-service.js";

const emailWorker = new Worker(
  "email",
  async (job) => {
    console.log(`Processing job ${job.id}`);

    switch (job.name) {
      case "verify-email": {
        const otp =
          job.data.otp ?? (await createEmailVerificationOtp(job.data.userId));

        await sendVerificationEmail({
          email: job.data.email,
          otp,
          userId: job.data.userId,
        });

        break;
      }

      case "booking-confirmation": {
        const user = await User.findById(job.data.userId)
          .select("email")
          .lean();

        if (!user) {
          throw new Error("User not found for booking confirmation email");
        }

        await sendBookingConfirmationEmail({
          email: user.email,
          bookingId: job.data.bookingId,
          userId: job.data.userId,
        });

        break;
      }

      default:
        throw new Error(`Unknown email job: ${job.name}`);
    }
  },
  {
    connection: {
      url: env.redisUrl,
    },
  },
);

emailWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

emailWorker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

export default emailWorker;

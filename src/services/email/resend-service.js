import { Resend } from "resend";
import env from "../../config/env.js";

const resend = new Resend(env.resendApiKey);

const sendVerificationEmail = async ({ email, otp, userId }) => {
  const { data, error } = await resend.emails.send(
    {
      from: env.emailFrom,

      to: ["eyadwld208@gmail.com"],

      subject: "Verify your Cinema Booking account",

      html: `
                    <div>
                        <h2>Verify your email</h2>

                        <p>
                            Your verification code is:
                        </p>

                        <h1>${otp}</h1>

                        <p>
                            This code expires in 10 minutes.
                        </p>

                        <p>
                            If you did not create this account,
                            you can ignore this email.
                        </p>
                    </div>
                `,
    },
    {
      /*
       * Resend caches the idempotency key for 24 hours and
       * replays the first response instead of sending again.
       *
       * The OTP is part of the key so a new code is a new
       * delivery, while a retried job stays idempotent.
       */
      idempotencyKey: `verify-email:${userId}:${otp}`,
    },
  );

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
};

export const sendBookingConfirmationEmail = async ({
  email,
  bookingId,
  userId,
}) => {
  const { data, error } = await resend.emails.send(
    {
      from: env.emailFrom,

      to: ["eyadwld208@gmail.com"],

      subject: "Your Cinema Booking is confirmed",

      html: `
                    <div>
                        <h2>Booking confirmed</h2>

                        <p>
                            Your booking is confirmed:
                        </p>

                        <h1>${bookingId}</h1>

                        <p>
                            Enjoy the show.
                        </p>
                    </div>
                `,
    },
    {
      idempotencyKey: `booking-confirmation:${bookingId}:${userId}`,
    },
  );

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
  console.log("Hello from resend booking confimationEmail");
  return data;
};

export const sendPasswordResetEmail = async ({ email, otp, userId }) => {
  const { data, error } = await resend.emails.send(
    {
      from: env.emailFrom,

      to: ["eyadwld208@gmail.com"],

      subject: "Reset your Cinema Booking password",

      html: `
                    <div>
                        <h2>Reset your password</h2>

                        <p>
                            Your password reset code is:
                        </p>

                        <h1>${otp}</h1>

                        <p>
                            This code expires in 10 minutes.
                        </p>

                        <p>
                            If you did not request a password reset,
                            you can ignore this email.
                        </p>
                    </div>
                `,
    },
    {
      idempotencyKey: `password-reset:${userId}:${otp}`,
    },
  );

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
};

export default sendVerificationEmail;

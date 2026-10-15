import { Resend } from "resend";
import env from "../../config/env.js";

const resend = new Resend(env.resendApiKey);

const sendVerificationEmail = async ({ email, otp, userId }) => {
  const { data, error } = await resend.emails.send(
    {
      from: env.emailFrom,

      to: [email],

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
      idempotencyKey: `verify-email:${userId}`,
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

      to: [email],

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

  return data;
};

export default sendVerificationEmail;

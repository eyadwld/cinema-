import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import errorMiddleware from "./middlewares/error-middleware.js";

import requestLogger from "./middlewares/request-logger.js";

import AppError from "./utils/appError.js";

import authRoutes from "./modules/auth/auth-routes.js";
import cinemaRoutes from "./modules/cinema/cinema-routes.js";
import movieRoutes from "./modules/movies/movies-routes.js";
import screenRoutes from "./modules/screen/screen-router.js";
import seatRoutes from "./modules/seat/seat-routes.js";
import showtimeRoutes from "./modules/showTime/showtime-routes.js";
import bookingRoutes from "./modules/booking/booking-routes.js";
import paymentRoutes from "./modules/payment/payment-routes.js";
import healthRoutes from "./health.js";

import { Resend } from "resend";
import env from "./config/env.js";

const app = express();

app.use(helmet());

app.use(cors());

app.use(cookieParser());

app.use(express.json({ limit: "100kb" }));

app.use(requestLogger);

const resend = new Resend(env.resendApiKey);

// const sendVerificationEmail = async ({ email, otp, userId }) => {
//   const { data, error } = await resend.emails.send(
//     {
//       from: env.emailFrom,

//       to: [email],

//       subject: "Verify your Cinema Booking account",

//       html: `
//                     <div>
//                         <h2>Verify your email</h2>

//                         <p>
//                             Your verification code is:
//                         </p>

//                         <h1>${otp}</h1>

//                         <p>
//                             This code expires in 10 minutes.
//                         </p>

//                         <p>
//                             If you did not create this account,
//                             you can ignore this email.
//                         </p>
//                     </div>
//                 `,
//     },
//     {
//       idempotencyKey: `verify-email:${userId}`,
//     },
//   );

//   if (error) {
//     throw new Error(`Resend error: ${error.message}`);
//   }

//   console.log("Email Sent");
// };
// sendVerificationEmail({
//   email: "eyadwld208@gmail.com",
//   otp: "123456",
//   userId: "55555555",
// });

app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cinemas", cinemaRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/screens", screenRoutes);
app.use("/api/seats", seatRoutes);
app.use("/api/showtimes", showtimeRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api", paymentRoutes);

app.use((req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

app.use(errorMiddleware);

export default app;

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

const app = express();

app.use(helmet());

app.use(cors());

app.use(cookieParser());

app.use(express.json({ limit: "100kb" }));

app.use(requestLogger);

app.use(express.urlencoded({ extended: true }));

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

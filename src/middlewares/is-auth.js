import jwt from "jsonwebtoken";
import env from "../config/env.js";

import AppError from "../utils/appError.js";

import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.get("authorization");

    if (!authorization) {
      throw new AppError("Authentication required", 401);
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError("Invalid authorization header", 401);
    }

    const decoded = jwt.verify(token, env.jwtAccessSecret);

    if (decoded.type !== "access") {
      throw new AppError("Invalid access token", 401);
    }

    req.auth = {
      userId: decoded.sub,
      sessionId: decoded.sid,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    if (error?.name === "TokenExpiredError") {
      return next(new AppError("Access token expired", 401));
    }

    if (error?.name === "JsonWebTokenError") {
      return next(new AppError("Invalid access token", 401));
    }

    next(error);
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select("role");

    if (!user) {
      throw new AppError("Authentication required", 401);
    }

    if (user.role !== "ADMIN") {
      throw new AppError("Forbidden", 403);
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth = authMiddleware;

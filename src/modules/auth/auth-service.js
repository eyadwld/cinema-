import mongoose, { Error } from "mongoose";
import argon2 from "argon2";
import jwt from "jsonwebtoken";

import User from "../../models/User.js";
import Session from "../../models/Session-model.js";
import OutboxEvent from "../../models/OutboxEvent.js";

import AppError from "../../utils/appError.js";

import env from "../../config/env.js";

import jwtConfig from "../../config/jwt.js";

import {
  hashToken,
  generateAccessToken,
  generateRefreshToken,
} from "../../utils/token.js";

import {
  createEmailVerificationOtp,
  verifyEmailVerificationOtp,
} from "./otp-service.js";

import {
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginAttempts,
} from "./loginRateLimit-service.js";

const createSession = async ({ user, userAgent, ip }) => {
  const expiresAt = new Date(Date.now() + jwtConfig.refreshTtlMs);

  const session = new Session({
    userId: user._id,
    userAgent,
    ip,
    expiresAt,
    lastUsedAt: new Date(),
  });

  /*
   * Session ID must exist before generating
   * the refresh token because sid is inside JWT.
   */
  const refreshToken = generateRefreshToken({
    userId: user._id,
    sessionId: session._id,
  });

  session.refreshTokenHash = hashToken(refreshToken);

  await session.save();

  const accessToken = generateAccessToken({
    userId: user._id,
    sessionId: session._id,
  });

  return {
    accessToken,
    refreshToken,
    session,
  };
};

export const registerService = async ({ name, email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase();

  const role = adminEmail && normalizedEmail === adminEmail ? "ADMIN" : "USER";

  const session = await mongoose.startSession();

  try {
    let user;

    await session.withTransaction(async () => {
      const existingUser = await User.findOne({
        email: normalizedEmail,
      })
        .lean()
        .session(session);

      if (existingUser) {
        throw new AppError("Unable to create account", 409);
      }
      const hashedPassword = await argon2.hash(password);

      const createdUsers = await User.create(
        [
          {
            name,
            email: normalizedEmail,
            hashedPassword,
            role,
            isEmailVerified: false,
          },
        ],
        { session },
      );

      user = createdUsers[0];

      /*
       * Creates the OTP in Redis.
       *
       * Redis stores the hash, not the plaintext OTP.
       */

      await OutboxEvent.create(
        [
          {
            type: "VERIFY_EMAIL",
            aggregateId: user._id,
            payload: {
              email: user.email,
            },
          },
        ],
        { session },
      );
    });

    return user;
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("Unable to create account", 409);
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
*/
export const verifyUserService = async ({ email, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new AppError("Invalid verification request", 400);
  }

  if (user.isEmailVerified) {
    return user;
  }

  await verifyEmailVerificationOtp({
    userId: user._id,
    otp,
  });

  user.isEmailVerified = true;

  await user.save();

  return user;
};

export const resendVerificationEmail = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    return;
  }

  if (user.isEmailVerified) {
    return;
  }

  const otp = await createEmailVerificationOtp(user._id);

  await OutboxEvent.create({
    type: "VERIFY_EMAIL",
    aggregateId: user._id,
    payload: {
      email: user.email,
      otp,
    },
  });
};

export const loginService = async ({ email, password, userAgent, ip }) => {
  const normalizedEmail = email.trim().toLowerCase();

  /*
   * Rate limiting should happen before expensive
   * password verification.
   */
  await checkLoginRateLimit(normalizedEmail, ip);

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+hashedPassword");

  if (!user) {
    await recordFailedLogin(normalizedEmail, ip);

    throw new AppError("Invalid email or password", 401);
  }

  const passwordValid = await argon2.verify(user.hashedPassword, password);

  if (!passwordValid) {
    await recordFailedLogin(normalizedEmail, ip);

    throw new AppError("Invalid email or password", 401);
  }

  /*
   * Only verified users can create sessions.
   */
  if (!user.isEmailVerified) {
    throw new AppError("Please verify your email before logging in", 403);
  }

  /*
   * Successful login clears the failed-attempt
   * counter.
   */
  await clearLoginAttempts(normalizedEmail, ip);

  const { accessToken, refreshToken, session } = await createSession({
    user,
    userAgent,
    ip,
  });

  return {
    user,
    accessToken,
    refreshToken,
    session,
  };
};

/*
|--------------------------------------------------------------------------
| Me
|--------------------------------------------------------------------------
*/

export const meService = async (userId) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  return user;
};

export const refreshSessionService = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError("Refresh token required", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  if (decoded.type !== "refresh") {
    throw new AppError("Invalid refresh token", 401);
  }

  if (!decoded.sid || !decoded.sub) {
    throw new AppError("Invalid refresh token", 401);
  }

  const session = await Session.findById(decoded.sid);

  if (!session) {
    throw new AppError("Invalid session", 401);
  }

  if (session.revokedAt) {
    throw new AppError("Session revoked", 401);
  }

  if (session.expiresAt <= new Date()) {
    throw new AppError("Session expired", 401);
  }

  /*
   * Hash the submitted refresh token.
   */
  const oldHash = hashToken(refreshToken);

  if (oldHash !== session.refreshTokenHash) {
    if (oldHash === session.previousRefreshTokenHash) {
      await Session.findOneAndUpdate(
        {
          _id: session._id,
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
          },
        },
      );

      throw new AppError("Refresh token reuse detected", 401);
    }

    throw new AppError("Invalid refresh token", 401);
  }

  /*
   * Create a completely new refresh token.
   */
  const newRefreshToken = generateRefreshToken({
    userId: session.userId,
    sessionId: session._id,
  });

  const newRefreshHash = hashToken(newRefreshToken);

  const updatedSession = await Session.findOneAndUpdate(
    {
      _id: session._id,
      refreshTokenHash: oldHash,
      revokedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    },
    {
      $set: {
        previousRefreshTokenHash: oldHash,

        refreshTokenHash: newRefreshHash,

        lastUsedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!updatedSession) {
    throw new AppError("Refresh token already used", 401);
  }

  const accessToken = generateAccessToken({
    userId: session.userId,
    sessionId: session._id,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

export const revokeSessionByTokenService = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  let decoded;

  try {
    decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
  } catch {
    return;
  }

  if (decoded.type !== "refresh" || !decoded.sid) {
    return;
  }

  await Session.findOneAndUpdate(
    {
      _id: decoded.sid,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );
};

export const revokeAllSessionsService = async (userId) => {
  await Session.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );
};

export const getSessionsService = async (userId) => {
  return Session.find({
    userId,
    revokedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  })
    .select("_id userAgent ip createdAt lastUsedAt expiresAt")
    .sort({
      lastUsedAt: -1,
    })
    .lean();
};

export const revokeSpecificSessionService = async ({ userId, sessionId }) => {
  const result = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );

  if (!result) {
    throw new AppError("Session not found", 404);
  }
};

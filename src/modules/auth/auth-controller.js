import * as service from "./auth-service.js";

import AppError from "../../utils/appError.js";

import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  REFRESH_COOKIE_NAME,
} from "../../utils/cookies.js";

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const user = await service.registerService({
      name,
      email,
      password,
    });

    res.status(201).json({
      success: true,
      message: "Account created. Please verify your email.",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await service.loginService({
      email,
      password,

      userAgent: req.get("user-agent"),

      ip: req.ip,
    });

    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      success: true,

      accessToken: result.accessToken,

      user: {
        id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      throw new AppError("Authentication required", 401);
    }

    const result = await service.refreshSessionService(refreshToken);

    setRefreshTokenCookie(res, result.refreshToken);

    res.json({
      success: true,

      accessToken: result.accessToken,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);

    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE_NAME];

    if (refreshToken) {
      await service.revokeSessionByTokenService(refreshToken);
    }

    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (req, res, next) => {
  try {
    const userId = req.auth.userId;

    await service.revokeAllSessionsService(userId);

    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: "All sessions have been logged out",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Current User
|--------------------------------------------------------------------------
*/

export const me = async (req, res, next) => {
  try {
    const user = await service.meService(req.auth.userId);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Get Active Sessions
|--------------------------------------------------------------------------
*/

export const getSessions = async (req, res, next) => {
  try {
    const sessions = await service.getSessionsService(req.auth.userId);

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Revoke Specific Session
|--------------------------------------------------------------------------
*/

export const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await service.revokeSpecificSessionService({
      userId: req.auth.userId,
      sessionId,
    });

    res.json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
*/

export const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await service.verifyUserService({
      email,
      otp,
    });

    res.json({
      success: true,

      message: "Email verified successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    await service.resendVerificationEmail({
      email,
    });

    res.json({
      success: true,

      message:
        "If the account exists and is not verified, a verification code has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

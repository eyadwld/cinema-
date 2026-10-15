import crypto from "crypto";
import jwt from "jsonwebtoken";

import jwtConfig from "../config/jwt.js";

const generateRandomToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateAccessToken = ({ userId, sessionId, role }) => {
  return jwt.sign(
    {
      sub: userId.toString(),
      sid: sessionId.toString(),
      role,
      type: "access",
    },
    jwtConfig.accessSecret,
    {
      expiresIn: jwtConfig.accessExpiresIn,
    },
  );
};

export const generateRefreshToken = ({ userId, sessionId }) => {
  const jti = generateRandomToken();

  return jwt.sign(
    {
      sub: userId.toString(),
      sid: sessionId.toString(),
      jti, //jwt id used to identify the token in function of refresh token rotation for example
      type: "refresh",
    },
    jwtConfig.refreshSecret,
    {
      expiresIn: Math.floor(jwtConfig.refreshTtlMs / 1000),
    },
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.accessSecret);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshSecret);
};

import env from "../config/env.js";

export const REFRESH_COOKIE_NAME =
  env.nodeEnv === "production" ? "__Host-refreshToken" : "refreshToken";

const refreshCookieOptions = {
  httpOnly: true,

  secure: env.nodeEnv === "production",

  sameSite: "strict", //to prevent CSRF attacks and it differ from the default value of "lax" which allows some cross-site requests to include cookies and it is important to set it to "strict" for sensitive cookies like refresh tokens

  path: "/api/auth", // set the path to "/api/auth" to ensure that the cookie is only sent with requests to the authentication endpoints and not with other requests to the server

  maxAge: Number(env.refreshTokenTtlDays) * 24 * 60 * 60 * 1000,
};

export const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
};

export const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path,
  });
};

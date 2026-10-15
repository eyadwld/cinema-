import env from "./env.js";

const jwtConfig = {
  accessSecret: env.jwtAccessSecret,
  refreshSecret: env.jwtRefreshSecret,

  accessExpiresIn: env.accessTokenTtl,

  refreshTtlMs: Number(env.refreshTokenTtlDays) * 24 * 60 * 60 * 1000,
};

export default jwtConfig;

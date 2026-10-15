import { config } from "dotenv";

config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  port: Number(process.env.PORT) || 3000,

  mongoUrl: process.env.MONGO_URI,

  redisUrl: process.env.REDIS_URL,

  sessionSecret: process.env.SESSION_SECRET,

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,

  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",

  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,

  otpHashSecret: process.env.OTP_HASH_SECRET,

  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM,

  paymobBaseUrl: process.env.PAYMOB_BASE_URL || "https://accept.paymob.com",

  paymobSecretKey: process.env.PAYMOB_SECRET_KEY,

  paymobIntegrationId: process.env.PAYMOB_INTEGRATION_ID,

  paymobNotificationUrl: process.env.PAYMOB_NOTIFICATION_URL,

  paymobRedirectionUrl: process.env.PAYMOB_REDIRECTION_URL,

  paymobPublicKey: process.env.PAYMOB_PUBLIC_KEY,

  paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
  paymobApiKey: process.env.PAYMOB_API_KEY,

  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
};

export default env;

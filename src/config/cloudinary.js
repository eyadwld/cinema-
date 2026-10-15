import { v2 as cloudinary } from "cloudinary";

import env from "./env.js";

cloudinary.config({
  cloud_name: env.cloud_name,
  api_key: env.api_key,
  api_secret: env.api_secret,
}); // this code imports the Cloudinary SDK and configures it with the necessary credentials (cloud name, API key, and API secret) from environment variables. It then exports the configured Cloudinary instance for use in other parts of the application.
export default cloudinary;

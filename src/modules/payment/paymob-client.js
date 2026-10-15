import env from "../../config/env.js";
import AppError from "../../utils/appError.js";
import { error as logError, info as logInfo } from "../../utils/logger.js";

const API_VERSION = "v1";

const baseUrl = () => (env.paymobBaseUrl || "https://accept.paymob.com").replace(/\/+$/, "");

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Token ${env.paymobSecretKey}`,
});

const parseBody = async (response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

export const createIntention = async (payload) => {
  if (!env.paymobSecretKey) {
    throw new AppError("Payment provider is not configured", 500);
  }

  const url = `${baseUrl()}/${API_VERSION}/intention/`;

  logInfo("Paymob intention create", { amount: payload?.amount });

  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseBody(response);

  if (!response.ok) {
    logError("Paymob intention create failed", {
      status: response.status,
      data,
    });

    throw new AppError(data?.detail || data?.message || "Payment provider unavailable", 502);
  }

  return data;
};

export const retrieveIntention = async (reference) => {
  if (!reference) {
    throw new AppError("Reference is required", 400);
  }

  if (!env.paymobSecretKey) {
    throw new AppError("Payment provider is not configured", 500);
  }

  const url = `${baseUrl()}/${API_VERSION}/intention/${reference}`;

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });

  const data = await parseBody(response);

  if (!response.ok) {
    logError("Paymob intention retrieve failed", {
      status: response.status,
      data,
    });

    throw new AppError(data?.detail || data?.message || "Payment provider unavailable", 502);
  }

  return data;
};

export const buildCheckoutUrl = (clientSecret) => {
  if (!clientSecret) {
    return null;
  }

  return `${baseUrl()}/unifiedcheckout/?publicKey=${env.paymobPublicKey}&clientSecret=${clientSecret}`;
};

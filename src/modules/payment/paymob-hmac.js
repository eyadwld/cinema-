import crypto from "crypto";

import env from "../../config/env.js";

const toHmacString = (value) => {
  if (value === true) {
    return "true";
  }

  if (value === false) {
    return "false";
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
};

export const buildHmacPayload = (obj = {}) => {
  const source = obj.source_data || {};
  const orderId = obj.order?.id ?? obj.order_id ?? obj.merchant_order_id ?? "";

  const parts = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    orderId,
    obj.owner,
    obj.pending,
    source.pan,
    source.sub_type,
    source.type,
    obj.success,
  ];

  return parts.map(toHmacString).join("");
};

export const computeHmac = (obj = {}) => {
  if (!env.paymobHmacSecret) {
    return null;
  }

  return crypto.createHmac("sha512", env.paymobHmacSecret).update(buildHmacPayload(obj)).digest("hex");
};

export const verifyPaymobHmac = (obj = {}, hmacParam) => {
  if (!hmacParam || !env.paymobHmacSecret) {
    return false;
  }

  const expected = computeHmac(obj);

  if (!expected) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(hmacParam)));
  } catch {
    return false;
  }
};

export const buildEventFingerprint = (obj = {}, rawBody = null) => {
  if (obj?.id !== undefined && obj?.id !== null && obj?.id !== "") {
    return `txn:${String(obj.id)}`;
  }

  if (rawBody) {
    const hash = crypto.createHash("sha256").update(JSON.stringify(rawBody)).digest("hex");

    return `raw:${hash}`;
  }

  return `txn:unknown:${Date.now()}`;
};

export const isSuccessfulTransaction = (obj = {}) =>
  obj.success === true && obj.pending === false && obj.is_voided !== true && obj.is_refunded !== true;

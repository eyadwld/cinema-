import crypto from "node:crypto";
import env from "../../config/env.js";

function getPath(obj, path) {
  let value = obj;

  for (const key of path.split(".")) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    value = value[key];
  }

  return value;
}

const PAYMOB_TRANSACTION_HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
];

function buildTransactionHmacString(obj) {
  const values = [];

  for (const field of PAYMOB_TRANSACTION_HMAC_FIELDS) {
    const value = getPath(obj, field);

    // Missing fields are different from fields explicitly set to null.
    // Reject missing fields instead of silently signing "undefined".
    if (value === undefined) {
      throw new Error(`Missing Paymob HMAC field: ${field}`);
    }

    if (typeof value === "boolean") {
      values.push(value ? "true" : "false");
    } else {
      // IMPORTANT:
      // Paymob's documentation does not specify one universal string
      // representation for every nullable field across payment methods.
      // Verify null handling against a real callback for your integration.
      values.push(String(value));
    }
  }

  return values.join("");
}

export function verifyPaymobTransactionHmac(obj, receivedHmac) {
  if (
    !env.paymobHmacSecret ||
    !obj ||
    typeof obj !== "object" ||
    Array.isArray(obj) ||
    typeof receivedHmac !== "string" ||
    !/^[a-fA-F0-9]{128}$/.test(receivedHmac)
  ) {
    return false;
  }

  let signedString;

  try {
    signedString = buildTransactionHmacString(obj);
  } catch {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", env.paymobHmacSecret)
    .update(signedString, "utf8")
    .digest();

  const received = Buffer.from(receivedHmac, "hex");

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
}

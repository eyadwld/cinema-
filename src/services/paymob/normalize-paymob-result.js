function requireIdentifier(value, fieldName) {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim() === ""
  ) {
    throw new Error(`Invalid Paymob field: ${fieldName}`);
  }

  return String(value);
}

function requireBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Paymob field: ${fieldName}`);
  }

  return value;
}

function optionalBoolean(obj, keys, fieldName) {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return requireBoolean(obj[key], fieldName);
    }
  }

  return false;
}

export function normalizePaymobTransaction(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("Invalid Paymob transaction object");
  }

  const transactionId = requireIdentifier(obj.id, "id");
  const orderId = requireIdentifier(obj.order?.id, "order.id");

  const amountMinor = Number(obj.amount_cents);

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid Paymob amount_cents");
  }

  if (typeof obj.currency !== "string" || obj.currency.trim() === "") {
    throw new Error("Invalid Paymob currency");
  }

  const success = requireBoolean(obj.success, "success");
  const pending = requireBoolean(obj.pending, "pending");
  const errorOccurred = requireBoolean(obj.error_occured, "error_occured");

  if (success && pending) {
    throw new Error(
      "Inconsistent Paymob result: success and pending are both true",
    );
  }

  const merchantReference =
    obj.order?.merchant_order_id ?? obj.merchant_order_id ?? null;

  if (
    merchantReference !== null &&
    typeof merchantReference !== "string" &&
    typeof merchantReference !== "number"
  ) {
    throw new Error("Invalid Paymob merchant_order_id");
  }

  return {
    transactionId,
    orderId,
    merchantReference:
      merchantReference === null ? null : String(merchantReference),
    amountMinor,
    currency: obj.currency,
    success,
    pending,
    errorOccurred,
    isVoided: optionalBoolean(obj, ["is_voided", "is_void"], "is_voided"),
    isRefunded: optionalBoolean(
      obj,
      ["is_refunded", "is_refund"],
      "is_refunded",
    ),
  };
}

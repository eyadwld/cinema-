import asyncHandler from "../../utils/async-handler.js";

import PaymentAttempt from "../../models/PaymentAttempt.js";

import { verifyPaymobTransactionHmac } from "../../services/paymob/paymob-hmac.js";

import { normalizePaymobTransaction } from "../../services/paymob/normalize-paymob-result.js";

import { createPaymobEventFingerprint } from "../../services/paymob/paymob-event-fingerprint.js";

import { processPaymobTransaction } from "./payment-result-service.js";

export const handlePaymobWebhook = asyncHandler(async (req, res) => {
  const callbackType = req.body?.type;
  const obj = req.body?.obj;
  const hmac = req.query?.hmac;

  if (
    callbackType !== "TRANSACTION" ||
    !obj ||
    typeof obj !== "object" ||
    Array.isArray(obj) ||
    typeof hmac !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid Paymob callback payload",
    });
  }

  // Verify the raw Paymob object before trusting any identifiers
  // or transaction fields contained in it.
  const validHmac = verifyPaymobTransactionHmac(obj, hmac);

  if (!validHmac) {
    return res.status(401).json({
      success: false,
      message: "Invalid Paymob callback signature",
    });
  }

  let transaction;

  try {
    transaction = normalizePaymobTransaction(obj);
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid Paymob transaction data",
    });
  }

  let attempt = await PaymentAttempt.findOne({
    provider: "PAYMOB",
    providerOrderId: transaction.orderId,
  });

  // An early callback may arrive before our API has saved
  // providerOrderId. Use our reference only if Paymob returned it
  // in the signed transaction payload.
  if (!attempt && transaction.merchantReference) {
    attempt = await PaymentAttempt.findOne({
      provider: "PAYMOB",
      specialReference: transaction.merchantReference,
    });
  }

  if (!attempt) {
    // Temporary failure allows a provider retry if supported.
    // The reconciliation scanner should also recover the attempt.
    return res.status(503).json({
      success: false,
      message: "Payment attempt is not available yet",
    });
  }

  // If Paymob supplied our own reference, it must match the attempt
  // we found. Never silently link a valid transaction to another booking.
  if (
    transaction.merchantReference &&
    transaction.merchantReference !== attempt.specialReference
  ) {
    return res.status(409).json({
      success: false,
      message: "Payment reference mismatch",
    });
  }

  const fingerprint = createPaymobEventFingerprint(obj);

  const result = await processPaymobTransaction({
    attemptId: attempt._id,
    transaction,
    webhookEvent: {
      fingerprint,
      eventType: callbackType,
    },
  });

  // Duplicate callbacks are acknowledged after idempotent handling,
  // avoiding unnecessary provider retries.
  return res.status(200).json({
    success: true,
    data: result,
  });
});

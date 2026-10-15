import crypto from "node:crypto";

export function createPaymobEventFingerprint(obj) {
  const fingerprintData = {
    transactionId: String(obj.id),
    orderId: String(obj.order?.id),
    amount: String(obj.amount_cents),
    currency: String(obj.currency),
    success: obj.success,
    pending: obj.pending,
    errorOccurred: obj.error_occured,
    isVoided: obj.is_voided ?? obj.is_void ?? null,
    isRefunded: obj.is_refunded ?? obj.is_refund ?? null,
    updatedAt: obj.updated_at ?? null,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(fingerprintData))
    .digest("hex");
}

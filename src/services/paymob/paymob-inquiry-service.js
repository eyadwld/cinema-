import env from "../../config/env.js";
import { generatePaymobAuthToken } from "./paymob-auth-service.js";

export class PaymobInquiryError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "PaymobInquiryError";
    this.retryable = options.retryable ?? true;
    this.statusCode = options.statusCode;
  }
}

export async function inquirePaymobTransactionByReference(specialReference) {
  if (typeof specialReference !== "string" || !specialReference.trim()) {
    throw new PaymobInquiryError(
      "A valid Paymob merchant reference is required",
      { retryable: false },
    );
  }

  const authToken = await generatePaymobAuthToken();

  let response;

  try {
    response = await fetch(
      `${env.paymobBaseUrl}/api/ecommerce/orders/transaction_inquiry`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auth_token: authToken,
          merchant_order_id: specialReference,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    throw new PaymobInquiryError("Paymob transaction inquiry request failed");
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new PaymobInquiryError(
      "Paymob returned an unreadable inquiry response",
      {
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 429,
      },
    );
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;

    throw new PaymobInquiryError(
      `Paymob inquiry failed with HTTP ${response.status}`,
      {
        statusCode: response.status,
        retryable,
      },
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    data.id === undefined ||
    data.id === null
  ) {
    // A missing transaction record is not proof that payment failed.
    throw new PaymobInquiryError(
      "Paymob inquiry returned no usable transaction record",
    );
  }

  return data;
}

import env from "../../config/env.js";

export class PaymobError extends Error {
  constructor(message, { outcomeUnknown = false, statusCode = null } = {}) {
    super(message);
    this.name = "PaymobError";
    this.outcomeUnknown = outcomeUnknown;
    this.statusCode = statusCode;
  }
}

export async function createPaymobIntention({
  amountMinor,
  currency,
  billingData,
  specialReference,
}) {  if (!env.paymobSecretKey || !env.paymobIntegrationId) {
    throw new Error("Paymob credentials are not configured");
  }

  if (!env.paymobNotificationUrl || !env.paymobRedirectionUrl) {
    throw new Error("Paymob callback URLs are not configured");
  }

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid payment amount");
  }

  if (currency !== "EGP") {
    throw new Error("Unsupported payment currency");
  }

  const source = billingData ?? {};
  const phoneNumber = source.phone_number ?? source.phone;
  const billing_data = {};

  if (source.first_name !== undefined) billing_data.first_name = source.first_name;
  if (source.last_name !== undefined) billing_data.last_name = source.last_name;
  if (source.email !== undefined) billing_data.email = source.email;
  if (phoneNumber !== undefined) billing_data.phone_number = phoneNumber;

  const body = {
    amount: amountMinor,
    currency,
    payment_methods: [Number(env.paymobIntegrationId)],
    billing_data,
    special_reference: specialReference,
    notification_url: env.paymobNotificationUrl,
    redirection_url: env.paymobRedirectionUrl,
    items: [
      {
        name: "Cinema booking",
        amount: amountMinor,
        description: "Cinema booking payment",
        quantity: 1,
      },
    ],
  };

  let response;

  try {
    response = await fetch(`${env.paymobBaseUrl}/v1/intention/`, {
      method: "POST",
      headers: {
        Authorization: `Token ${env.paymobSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    // Timeout/network failure does not prove that Paymob
    // failed to create the intention.
    throw new PaymobError("Paymob intention outcome is unknown", {
      outcomeUnknown: true,
    });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // Treat only documented, definitive rejection responses
    // as safe to mark FAILED. Be conservative otherwise.
    const definitiveRejection = response.status >= 400 && response.status < 500;

    throw new PaymobError(
      data?.message || `Paymob returned HTTP ${response.status}`,
      {
        statusCode: response.status,
        outcomeUnknown: !definitiveRejection,
      },
    );
  }

  if (
    data?.id == null ||
    data?.intention_order_id == null ||
    typeof data?.client_secret !== "string" ||
    !data.client_secret
  ) {
    // Paymob may have created the intention even if the response
    // is incomplete from our application's point of view.
    throw new PaymobError("Incomplete Paymob intention response", {
      outcomeUnknown: true,
    });
  }

  return {
    intentionId: String(data.id),
    orderId: String(data.intention_order_id),
    clientSecret: data.client_secret,
  };
}

export function buildPaymobCheckoutUrl(clientSecret) {
  if (!env.paymobPublicKey) {
    throw new Error("PAYMOB_PUBLIC_KEY is not configured");
  }

  const url = new URL("/unifiedcheckout/", env.paymobBaseUrl);
  url.searchParams.set("publicKey", env.paymobPublicKey);
  url.searchParams.set("clientSecret", clientSecret);

  return url.toString();
}

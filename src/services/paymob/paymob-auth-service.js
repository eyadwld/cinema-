import env from "../../config/env.js";

export async function generatePaymobAuthToken() {
  if (!env.paymobApiKey) {
    throw new Error("PAYMOB_API_KEY is not configured");
  }

  const response = await fetch(`${env.paymobBaseUrl}/api/auth/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: env.paymobApiKey,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || typeof data?.token !== "string") {
    throw new Error(
      `Paymob auth-token request failed: HTTP ${response.status}`,
    );
  }

  return data.token;
}

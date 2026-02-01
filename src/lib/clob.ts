import crypto from "crypto";

const CLOB_HOST = "https://clob.polymarket.com";

function buildHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ""
): string {
  const message = timestamp + method + requestPath + body;
  const hmacKey = Buffer.from(secret, "base64");
  return crypto
    .createHmac("sha256", hmacKey)
    .update(message)
    .digest("base64");
}

/**
 * Fetch the CLOB collateral balance (actual Polymarket cash balance).
 * Requires POLY_API_KEY, POLY_API_SECRET, POLY_API_PASSPHRASE env vars.
 */
export async function fetchClobBalance(walletAddress: string): Promise<number> {
  const apiKey = process.env.POLY_API_KEY;
  const apiSecret = process.env.POLY_API_SECRET;
  const apiPassphrase = process.env.POLY_API_PASSPHRASE;

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("Missing POLY_API_* env vars for CLOB balance");
    return 0;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.floor(Math.random() * 1000000).toString();
  const method = "GET";
  const path = "/balance-allowance?asset_type=COLLATERAL";

  const signature = buildHmacSignature(apiSecret, timestamp, method, path);

  try {
    const res = await fetch(`${CLOB_HOST}${path}`, {
      headers: {
        POLY_ADDRESS: walletAddress,
        POLY_SIGNATURE: signature,
        POLY_TIMESTAMP: timestamp,
        POLY_NONCE: nonce,
        POLY_API_KEY: apiKey,
        POLY_PASSPHRASE: apiPassphrase,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("CLOB balance fetch failed:", res.status);
      return 0;
    }

    const data = await res.json();
    return parseInt(data.balance || "0") / 1e6;
  } catch (e) {
    console.error("CLOB balance error:", e);
    return 0;
  }
}

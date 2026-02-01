const CLOB_HOST = "https://clob.polymarket.com";

async function buildHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method + requestPath + body;

  // Decode base64 secret to raw bytes
  const keyBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

  // Use Web Crypto API (works on both Vercel and Node.js)
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );

  // Base64-encode the signature
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

  try {
    const signature = await buildHmacSignature(
      apiSecret,
      timestamp,
      method,
      path
    );

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
      const text = await res.text();
      console.error("CLOB balance failed:", res.status, text);
      return 0;
    }

    const data = await res.json();
    return parseInt(data.balance || "0") / 1e6;
  } catch (e) {
    console.error("CLOB balance error:", e);
    return 0;
  }
}

const CLOB_HOST = "https://clob.polymarket.com";

async function buildHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ""
): Promise<string> {
  const message = timestamp + method + requestPath + body;

  // Decode base64url secret to raw bytes using Buffer (reliable on Node.js/Vercel)
  const keyBytes = new Uint8Array(Buffer.from(secret, "base64url"));

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

  // Base64url-encode WITH padding (matching py_clob_client's urlsafe_b64encode)
  return Buffer.from(new Uint8Array(sig))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Fetch the CLOB collateral balance (actual Polymarket cash balance).
 * Requires POLY_API_KEY, POLY_API_SECRET, POLY_API_PASSPHRASE, POLY_SIGNER_ADDRESS env vars.
 */
export async function fetchClobBalance(): Promise<number> {
  const apiKey = process.env.POLY_API_KEY;
  const apiSecret = process.env.POLY_API_SECRET;
  const apiPassphrase = process.env.POLY_API_PASSPHRASE;
  const signerAddress = process.env.POLY_SIGNER_ADDRESS;

  if (!apiKey || !apiSecret || !apiPassphrase || !signerAddress) {
    console.error("Missing POLY_API_* env vars for CLOB balance");
    return 0;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const method = "GET";
  // Sign only the path WITHOUT query params (matching py_clob_client)
  const signingPath = "/balance-allowance";
  // signature_type=2 tells CLOB to return the Gnosis Safe proxy balance
  const requestUrl = "/balance-allowance?asset_type=COLLATERAL&signature_type=2";

  try {
    const signature = await buildHmacSignature(
      apiSecret,
      timestamp,
      method,
      signingPath
    );

    const res = await fetch(`${CLOB_HOST}${requestUrl}`, {
      headers: {
        POLY_ADDRESS: signerAddress,
        POLY_SIGNATURE: signature,
        POLY_TIMESTAMP: timestamp,
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

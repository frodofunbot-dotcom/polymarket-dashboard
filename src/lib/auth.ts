import { createHmac } from "crypto";

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  return process.env.SESSION_SECRET || "default-secret-change-me";
}

export function verifyPassword(input: string): boolean {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return false;
  return input === password;
}

export function createSessionToken(): string {
  const timestamp = Date.now().toString();
  const sig = createHmac("sha256", getSecret()).update(timestamp).digest("hex");
  return `${timestamp}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, sig] = parts;
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  // Check expiry
  if (Date.now() - ts > SESSION_TTL) return false;

  // Check signature
  const expected = createHmac("sha256", getSecret())
    .update(timestamp)
    .digest("hex");
  return sig === expected;
}

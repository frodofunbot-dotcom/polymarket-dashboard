import { USDC_CONTRACT } from "./constants";

const RPCS = [
  "https://polygon-mainnet.g.alchemy.com/v2/demo",
  "https://polygon-rpc.com",
  "https://1rpc.io/matic",
];

export async function fetchUsdcBalance(wallet: string): Promise<number> {
  // ABI-encode balanceOf(address): 0x70a08231 + address padded to 32 bytes
  const addr = wallet.replace("0x", "").toLowerCase().padStart(64, "0");
  const calldata = `0x70a08231${addr}`;

  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: USDC_CONTRACT, data: calldata }, "latest"],
    id: 1,
  });

  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "polymarket-dashboard/1.0",
        },
        body: payload,
        cache: "no-store",
      });

      if (!res.ok) continue;

      const json = await res.json();
      const hex = json?.result;
      if (typeof hex === "string" && hex.length > 2) {
        const val = parseInt(hex, 16) / 1e6;
        if (val > 0) return val;
      }
    } catch {
      continue;
    }
  }

  return 0;
}

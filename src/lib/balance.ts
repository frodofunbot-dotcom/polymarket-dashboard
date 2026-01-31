import { POLYGON_RPC, USDC_CONTRACT } from "./constants";

export async function fetchUsdcBalance(wallet: string): Promise<number> {
  // ABI-encode balanceOf(address): 0x70a08231 + address padded to 32 bytes
  const addr = wallet.replace("0x", "").toLowerCase().padStart(64, "0");
  const data = `0x70a08231${addr}`;

  try {
    const res = await fetch(POLYGON_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: USDC_CONTRACT, data }, "latest"],
        id: 1,
      }),
      cache: "no-store",
    });

    const json = await res.json();
    console.log("RPC balance response:", JSON.stringify(json));
    if (json.result && json.result !== "0x") {
      const raw = parseInt(json.result, 16);
      const balance = raw / 1e6;
      console.log("Parsed balance:", balance);
      return balance;
    }
    return 0;
  } catch (e) {
    console.error("Failed to fetch USDC balance:", e);
    return 0;
  }
}

import { POLYGON_RPCS, USDC_CONTRACT } from "./constants";

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

  // Try each RPC endpoint until one works
  for (const rpc of POLYGON_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        cache: "no-store",
      });

      const json = await res.json();
      if (json.result && json.result !== "0x" && json.result !== "0x0") {
        return parseInt(json.result, 16) / 1e6;
      }
    } catch {
      // Try next RPC
      continue;
    }
  }

  console.error("All RPC endpoints failed for balance fetch");
  return 0;
}

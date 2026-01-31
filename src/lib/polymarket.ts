import { Position, Trade } from "./types";
import { DATA_API } from "./constants";

export async function fetchPositions(wallet: string): Promise<Position[]> {
  const res = await fetch(`${DATA_API}/positions?user=${wallet}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to fetch positions:", res.status);
    return [];
  }

  const raw: any[] = await res.json();

  return raw
    .filter((p) => parseFloat(p.size || "0") > 0)
    .map((p) => ({
      asset: p.asset || "",
      conditionId: p.conditionId || "",
      title: p.title || p.market || "Unknown",
      outcome: p.outcome || "",
      outcomeIndex: parseInt(p.outcomeIndex || "0", 10),
      size: parseFloat(p.size || "0"),
      avgPrice: parseFloat(p.avgPrice || "0"),
      curPrice: parseFloat(p.curPrice || "0"),
      initialValue: parseFloat(p.initialValue || "0"),
      currentValue: parseFloat(p.currentValue || "0"),
      cashPnl: parseFloat(p.cashPnl || "0"),
      percentPnl: parseFloat(p.percentPnl || "0"),
      realizedPnl: parseFloat(p.realizedPnl || "0"),
      redeemable: p.redeemable === true || p.redeemable === "true",
      slug: p.slug || "",
      endDate: p.endDate || "",
    }));
}

export async function fetchTrades(
  wallet: string,
  limit = 200
): Promise<Trade[]> {
  const res = await fetch(
    `${DATA_API}/activity?user=${wallet}&type=TRADE&sortBy=TIMESTAMP&sortDirection=DESC&limit=${limit}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    console.error("Failed to fetch trades:", res.status);
    return [];
  }

  const raw: any[] = await res.json();

  return raw.map((t) => ({
    timestamp: typeof t.timestamp === "string"
      ? Math.floor(new Date(t.timestamp).getTime() / 1000)
      : parseInt(t.timestamp || "0", 10),
    title: t.title || "",
    side: t.side === "SELL" ? "SELL" : "BUY",
    outcome: t.outcome || "",
    price: parseFloat(t.price || "0"),
    size: parseFloat(t.size || "0"),
    usdcSize: parseFloat(t.usdcSize || "0"),
    conditionId: t.conditionId || "",
    transactionHash: t.transactionHash || "",
    outcomeIndex: parseInt(t.outcomeIndex || "0", 10),
    slug: t.slug || "",
  }));
}

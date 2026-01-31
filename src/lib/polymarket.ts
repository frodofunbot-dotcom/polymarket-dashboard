import { Position, Trade, ArbStats, ArbSet } from "./types";
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

/**
 * Detect arb trade sets from trade history.
 * An arb set = cluster of 3+ BUY trades on different conditionIds within 120 seconds.
 */
export function detectArbSets(trades: Trade[]): ArbStats {
  const buys = trades
    .filter((t) => t.side === "BUY")
    .sort((a, b) => a.timestamp - b.timestamp);

  const sets: ArbSet[] = [];
  let i = 0;

  while (i < buys.length) {
    // Collect all BUYs within 120s of this one
    const cluster: Trade[] = [buys[i]];
    let j = i + 1;
    while (j < buys.length && buys[j].timestamp - buys[i].timestamp <= 120) {
      // Only group if different conditionId (different outcome)
      if (!cluster.some((c) => c.conditionId === buys[j].conditionId)) {
        cluster.push(buys[j]);
      }
      j++;
    }

    if (cluster.length >= 3) {
      sets.push({
        timestamp: cluster[0].timestamp,
        legs: cluster.length,
        totalCost: cluster.reduce((s, t) => s + t.usdcSize, 0),
        outcomes: cluster.map((t) => t.outcome || t.title),
      });
      i = j; // skip past this cluster
    } else {
      i++;
    }
  }

  return {
    totalSets: sets.length,
    totalSpent: sets.reduce((s, a) => s + a.totalCost, 0),
    totalLegs: sets.reduce((s, a) => s + a.legs, 0),
    sets,
  };
}

/**
 * Calculate true P&L from full activity history (trades + redemptions).
 * This avoids the issue where redeemed winning positions disappear from
 * the positions API, making the P&L look worse than it actually is.
 */
export async function fetchTruePnl(
  wallet: string,
  positions: Position[]
): Promise<number> {
  const res = await fetch(
    `${DATA_API}/activity?user=${wallet}&limit=1000`,
    { cache: "no-store" }
  );

  if (!res.ok) return 0;

  const activities: any[] = await res.json();

  let totalBought = 0;
  let totalSold = 0;
  let totalRedeemed = 0;

  for (const a of activities) {
    const usdc = parseFloat(a.usdcSize || "0");
    if (a.type === "TRADE") {
      if (a.side === "BUY") totalBought += usdc;
      else totalSold += usdc;
    } else if (a.type === "REDEEM") {
      totalRedeemed += usdc;
    }
  }

  const positionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);

  return totalSold + totalRedeemed + positionValue - totalBought;
}

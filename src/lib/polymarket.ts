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

/**
 * Calculate today's P&L from activity (trades + redemptions).
 * Filters all activity to UTC today, groups by conditionId,
 * and combines with open position unrealized P&L.
 */
export async function fetchTodayPnl(
  wallet: string,
  positions: Position[]
): Promise<{
  pnl: number;
  wins: number;
  losses: number;
  spent: number;
  revenue: number;
}> {
  const res = await fetch(
    `${DATA_API}/activity?user=${wallet}&limit=1000`,
    { cache: "no-store" }
  );

  if (!res.ok) return { pnl: 0, wins: 0, losses: 0, spent: 0, revenue: 0 };

  const activities: any[] = await res.json();

  // UTC midnight today
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const cutoffMs = todayStart.getTime();

  const todayActs = activities.filter((a) => {
    const ms =
      typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : parseInt(a.timestamp || "0", 10) * 1000;
    return ms >= cutoffMs;
  });

  // Group by conditionId
  const byCondition = new Map<
    string,
    { bought: number; sold: number; redeemed: number }
  >();

  for (const a of todayActs) {
    const cid = a.conditionId || "unknown";
    if (!byCondition.has(cid)) {
      byCondition.set(cid, { bought: 0, sold: 0, redeemed: 0 });
    }
    const c = byCondition.get(cid)!;
    const usdc = parseFloat(a.usdcSize || "0");

    if (a.type === "TRADE") {
      if (a.side === "BUY") c.bought += usdc;
      else c.sold += usdc;
    } else if (a.type === "REDEEM") {
      c.redeemed += usdc;
    }
  }

  let spent = 0;
  let revenue = 0;
  let wins = 0;
  let losses = 0;

  byCondition.forEach((c, cid) => {
    spent += c.bought;
    revenue += c.sold + c.redeemed;

    // Determine if this market is closed (has revenue and no open position)
    const openPos = positions.find(
      (p) =>
        (p.conditionId === cid || p.asset === cid) &&
        !p.redeemable &&
        p.curPrice > 0 &&
        p.curPrice < 1 &&
        p.size > 0
    );

    if (!openPos && c.bought > 0) {
      const net = c.sold + c.redeemed - c.bought;
      if (net > 0.005) wins++;
      else if (net < -0.005) losses++;
    }
  });

  // Add unrealized P&L from open positions that were traded today
  let unrealized = 0;
  positions.forEach((pos) => {
    const cid = pos.conditionId || pos.asset;
    if (
      byCondition.has(cid) &&
      !pos.redeemable &&
      pos.curPrice > 0 &&
      pos.curPrice < 1
    ) {
      unrealized += pos.cashPnl;
    }
  });

  const pnl = revenue - spent + unrealized;

  return { pnl, wins, losses, spent, revenue };
}

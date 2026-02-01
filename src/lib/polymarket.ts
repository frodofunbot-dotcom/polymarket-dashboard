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
 * Fetch all activity and calculate P&L.
 * All-time P&L = total sold + total redeemed - total bought + current position value
 * Today P&L = same formula but filtered to today's activity only
 */
export async function fetchPnl(
  wallet: string,
  positionValue: number
): Promise<{
  allTimePnl: number;
  todayPnl: number;
  todayWins: number;
  todayLosses: number;
}> {
  const res = await fetch(
    `${DATA_API}/activity?user=${wallet}&limit=1000`,
    { cache: "no-store" }
  );

  if (!res.ok) return { allTimePnl: 0, todayPnl: 0, todayWins: 0, todayLosses: 0 };

  const activities: any[] = await res.json();

  // UTC midnight today
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const cutoffMs = todayStart.getTime();

  let allBought = 0;
  let allSold = 0;
  let allRedeemed = 0;
  let todayBought = 0;
  let todaySold = 0;
  let todayRedeemed = 0;

  // Track today's markets for win/loss counting
  const todayByCondition = new Map<
    string,
    { bought: number; sold: number; redeemed: number }
  >();

  for (const a of activities) {
    const usdc = parseFloat(a.usdcSize || "0");
    const ms =
      typeof a.timestamp === "string"
        ? new Date(a.timestamp).getTime()
        : parseInt(a.timestamp || "0", 10) * 1000;
    const isToday = ms >= cutoffMs;

    if (a.type === "TRADE") {
      if (a.side === "BUY") {
        allBought += usdc;
        if (isToday) todayBought += usdc;
      } else {
        allSold += usdc;
        if (isToday) todaySold += usdc;
      }
    } else if (a.type === "REDEEM") {
      allRedeemed += usdc;
      if (isToday) todayRedeemed += usdc;
    }

    if (isToday) {
      const cid = a.conditionId || "unknown";
      if (!todayByCondition.has(cid)) {
        todayByCondition.set(cid, { bought: 0, sold: 0, redeemed: 0 });
      }
      const c = todayByCondition.get(cid)!;
      if (a.type === "TRADE") {
        if (a.side === "BUY") c.bought += usdc;
        else c.sold += usdc;
      } else if (a.type === "REDEEM") {
        c.redeemed += usdc;
      }
    }
  }

  // All-time: realized + current position value
  const allTimePnl = allSold + allRedeemed - allBought + positionValue;

  // Today: just realized (sold + redeemed - bought today)
  const todayPnl = todaySold + todayRedeemed - todayBought;

  // Count today's wins/losses per market
  let todayWins = 0;
  let todayLosses = 0;
  todayByCondition.forEach((c) => {
    const net = c.sold + c.redeemed - c.bought;
    if (net > 0.005) todayWins++;
    else if (net < -0.005) todayLosses++;
  });

  return { allTimePnl, todayPnl, todayWins, todayLosses };
}

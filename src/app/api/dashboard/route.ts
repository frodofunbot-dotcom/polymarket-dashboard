import { NextResponse } from "next/server";
import { fetchPositions, fetchTrades, fetchPnl } from "@/lib/polymarket";
import { fetchClobBalance } from "@/lib/clob";
import { getWalletAddress } from "@/lib/constants";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const wallet = getWalletAddress();
  const [positions, trades, cashBalance] = await Promise.all([
    fetchPositions(wallet),
    fetchTrades(wallet, 200),
    fetchClobBalance(),
  ]);

  // Filter trades to today (UTC midnight)
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todaySec = Math.floor(todayStart.getTime() / 1000);
  const todayTrades = trades.filter((t) => t.timestamp >= todaySec);

  // Live positions only (not expired)
  const openPositions = positions.filter(
    (p) =>
      !p.redeemable &&
      p.size > 0 &&
      (!p.endDate || new Date(p.endDate) > now)
  );

  const positionValue = openPositions.reduce((s, p) => s + p.currentValue, 0);

  // P&L from activity history
  const pnl = await fetchPnl(wallet, positionValue);
  const decided = pnl.todayWins + pnl.todayLosses;

  const data: DashboardData = {
    balance: cashBalance,
    positionValue,
    portfolioValue: cashBalance + positionValue,
    allTimePnl: pnl.allTimePnl,
    todayPnl: pnl.todayPnl,
    todayWins: pnl.todayWins,
    todayLosses: pnl.todayLosses,
    todayWinRate: decided > 0 ? (pnl.todayWins / decided) * 100 : 0,
    openPositions: openPositions.sort((a, b) => b.currentValue - a.currentValue),
    todayTrades: todayTrades.sort((a, b) => b.timestamp - a.timestamp),
    lastUpdated: new Date().toISOString(),
    walletAddress: wallet,
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=15, stale-while-revalidate=10",
    },
  });
}

import { NextResponse } from "next/server";
import { fetchPositions, fetchTrades, fetchTodayPnl } from "@/lib/polymarket";
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

  // Today's P&L from activity history
  const today = await fetchTodayPnl(wallet, positions);

  // Filter trades to today (UTC midnight)
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todaySec = Math.floor(todayStart.getTime() / 1000);
  const todayTrades = trades.filter((t) => t.timestamp >= todaySec);

  // Open positions only
  const openPositions = positions.filter(
    (p) => !p.redeemable && p.curPrice > 0 && p.curPrice < 1 && p.size > 0
  );

  const positionValue = openPositions.reduce((s, p) => s + p.currentValue, 0);
  const decided = today.wins + today.losses;

  const data: DashboardData = {
    balance: cashBalance,
    positionValue,
    portfolioValue: cashBalance + positionValue,
    todayPnl: today.pnl,
    todayWins: today.wins,
    todayLosses: today.losses,
    todayWinRate: decided > 0 ? (today.wins / decided) * 100 : 0,
    todaySpent: today.spent,
    todayRevenue: today.revenue,
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

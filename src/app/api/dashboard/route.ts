import { NextResponse } from "next/server";
import { fetchPositions, fetchTrades } from "@/lib/polymarket";
import { fetchUsdcBalance } from "@/lib/balance";
import { getWalletAddress } from "@/lib/constants";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const wallet = getWalletAddress();
  const [positions, trades, usdcBalance] = await Promise.all([
    fetchPositions(wallet),
    fetchTrades(wallet, 200),
    fetchUsdcBalance(wallet),
  ]);

  // Portfolio value = cash + all position values
  const positionValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const portfolioValue = usdcBalance + positionValue;

  // Total P&L across all positions
  const totalPnl = positions.reduce((sum, p) => sum + p.cashPnl, 0);

  // Win rate from resolved positions
  const resolved = positions.filter(
    (p) => p.redeemable || p.curPrice === 0 || p.curPrice === 1
  );
  const wins = resolved.filter(
    (p) => p.curPrice === 1 || p.redeemable
  ).length;
  const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;

  const data: DashboardData = {
    usdcBalance,
    portfolioValue,
    totalPnl,
    winRate,
    totalPositions: positions.length,
    positions: positions.sort((a, b) => b.currentValue - a.currentValue),
    trades: trades.sort((a, b) => b.timestamp - a.timestamp),
    lastUpdated: new Date().toISOString(),
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=15, stale-while-revalidate=10",
    },
  });
}

import { NextResponse } from "next/server";
import { fetchPositions, fetchTrades, fetchTruePnl } from "@/lib/polymarket";
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

  // True P&L from full activity history (trades + redemptions)
  // This accounts for redeemed positions that no longer appear in the positions API
  const totalPnl = await fetchTruePnl(wallet, positions);

  // Win/loss from positions with P&L
  const winning = positions.filter((p) => p.cashPnl > 0.01);
  const losing = positions.filter((p) => p.cashPnl < -0.01);
  const winCount = winning.length;
  const lossCount = losing.length;
  const decided = winCount + lossCount;
  const winRate = decided > 0 ? (winCount / decided) * 100 : 0;

  const data: DashboardData = {
    usdcBalance,
    portfolioValue,
    positionValue,
    totalPnl,
    winRate,
    winCount,
    lossCount,
    totalPositions: positions.length,
    positions: positions.sort((a, b) => b.currentValue - a.currentValue),
    trades: trades.sort((a, b) => b.timestamp - a.timestamp),
    lastUpdated: new Date().toISOString(),
    walletAddress: wallet,
  };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "s-maxage=15, stale-while-revalidate=10",
    },
  });
}

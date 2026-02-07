import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
import { fetchClobBalance } from "@/lib/clob";
import {
  SniperTrade,
  SniperDashboardData,
  CoinStats,
  HourStats,
  PriceBandStats,
  AIAdjustment,
  CurrentParams,
} from "@/lib/types";
import { BOT_DIR } from "@/lib/constants";

const CSV_PATH = path.join(BOT_DIR, "sniperbot_trades.csv");
const ADJ_PATH = path.join(BOT_DIR, "sniperbot_adjustments.log");
const JOURNAL_PATH = path.join(BOT_DIR, "sniperbot_journal.md");

function parseCsv(csvContent: string): SniperTrade[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length <= 1) return [];

  const trades: SniperTrade[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 16) continue;

    trades.push({
      timestamp: parts[0],
      coin: parts[1],
      slug: parts[2],
      entry_price: parseFloat(parts[3]) || 0,
      side: parts[4],
      amount_usdc: parseFloat(parts[5]) || 0,
      time_remaining: parseFloat(parts[6]) || 0,
      spread: parseFloat(parts[7]) || 0,
      ask_depth: parseFloat(parts[8]) || 0,
      book_imbalance: parseFloat(parts[9]) || 0,
      other_price: parseFloat(parts[10]) || 0,
      outcome: parts[11],
      payout: parseFloat(parts[12]) || 0,
      profit_loss: parseFloat(parts[13]) || 0,
      action: parts[14],
      order_result: parts[15],
    });
  }

  return trades;
}

function parseAdjustments(logContent: string): AIAdjustment[] {
  const lines = logContent.trim().split("\n");
  const adjustments: AIAdjustment[] = [];

  let currentEntry = "";
  let currentTimestamp = "";

  for (const line of lines) {
    // Check if line starts with timestamp pattern
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);

    if (timestampMatch) {
      // Save previous entry if exists
      if (currentEntry && currentTimestamp) {
        adjustments.push({
          timestamp: currentTimestamp,
          content: currentEntry.trim(),
        });
      }

      currentTimestamp = timestampMatch[1];
      currentEntry = line;
    } else if (currentEntry) {
      currentEntry += "\n" + line;
    }
  }

  // Add last entry
  if (currentEntry && currentTimestamp) {
    adjustments.push({
      timestamp: currentTimestamp,
      content: currentEntry.trim(),
    });
  }

  return adjustments.reverse(); // Most recent first
}

function parseCurrentParams(adjustments: AIAdjustment[]): CurrentParams {
  // Look for the most recent "Params after:" line
  for (const adj of adjustments) {
    // Use indexOf instead of regex with 's' flag for better compatibility
    const paramsIndex = adj.content.indexOf("Params after:");
    if (paramsIndex !== -1) {
      const afterParams = adj.content.substring(paramsIndex + 13).trim();
      const jsonMatch = afterParams.match(/({[\s\S]*})/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("Failed to parse params:", e);
        }
      }
    }
  }
  return {};
}

function calculateCoinStats(trades: SniperTrade[]): CoinStats[] {
  const coinMap = new Map<string, CoinStats>();

  trades.forEach((trade) => {
    if (!coinMap.has(trade.coin)) {
      coinMap.set(trade.coin, {
        coin: trade.coin,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnl: 0,
      });
    }

    const stats = coinMap.get(trade.coin)!;

    if (trade.action === "BUY" || trade.action === "DRY_BUY") {
      stats.trades++;
    }

    if (trade.outcome.toLowerCase() === "win") {
      stats.wins++;
      stats.pnl += trade.profit_loss;
    } else if (trade.outcome.toLowerCase() === "loss") {
      stats.losses++;
      stats.pnl += trade.profit_loss;
    }
  });

  const coinStats = Array.from(coinMap.values());
  coinStats.forEach((stat) => {
    const total = stat.wins + stat.losses;
    stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
  });

  return coinStats.sort((a, b) => b.pnl - a.pnl);
}

function calculateHourStats(trades: SniperTrade[]): HourStats[] {
  const hourMap = new Map<number, HourStats>();

  trades.forEach((trade) => {
    const hour = new Date(trade.timestamp).getUTCHours();

    if (!hourMap.has(hour)) {
      hourMap.set(hour, {
        hour,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      });
    }

    const stats = hourMap.get(hour)!;

    if (trade.action === "BUY" || trade.action === "DRY_BUY") {
      stats.trades++;
    }

    if (trade.outcome.toLowerCase() === "win") {
      stats.wins++;
    } else if (trade.outcome.toLowerCase() === "loss") {
      stats.losses++;
    }
  });

  const hourStats = Array.from(hourMap.values());
  hourStats.forEach((stat) => {
    const total = stat.wins + stat.losses;
    stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
  });

  return hourStats.sort((a, b) => a.hour - b.hour);
}

function calculatePriceBandStats(trades: SniperTrade[]): PriceBandStats[] {
  const bands = [
    { min: 0.5, max: 0.6, label: "0.50-0.60" },
    { min: 0.6, max: 0.7, label: "0.60-0.70" },
    { min: 0.7, max: 0.8, label: "0.70-0.80" },
    { min: 0.8, max: 0.85, label: "0.80-0.85" },
    { min: 0.85, max: 0.9, label: "0.85-0.90" },
    { min: 0.9, max: 0.95, label: "0.90-0.95" },
    { min: 0.95, max: 1.0, label: "0.95-1.00" },
  ];

  const bandMap = new Map<string, PriceBandStats>();

  bands.forEach((band) => {
    bandMap.set(band.label, {
      band: band.label,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    });
  });

  trades.forEach((trade) => {
    const price = trade.entry_price;
    const band = bands.find((b) => price >= b.min && price < b.max);

    if (band) {
      const stats = bandMap.get(band.label)!;

      if (trade.action === "BUY" || trade.action === "DRY_BUY") {
        stats.trades++;
      }

      if (trade.outcome.toLowerCase() === "win") {
        stats.wins++;
      } else if (trade.outcome.toLowerCase() === "loss") {
        stats.losses++;
      }
    }
  });

  const priceBandStats = Array.from(bandMap.values());
  priceBandStats.forEach((stat) => {
    const total = stat.wins + stat.losses;
    stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
  });

  return priceBandStats;
}

export async function GET() {
  try {
    // Read CSV file
    let trades: SniperTrade[] = [];
    if (fs.existsSync(CSV_PATH)) {
      const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
      trades = parseCsv(csvContent);
    }

    // Read adjustments log
    let adjustments: AIAdjustment[] = [];
    let currentParams: CurrentParams = {};
    if (fs.existsSync(ADJ_PATH)) {
      const adjContent = fs.readFileSync(ADJ_PATH, "utf-8");
      adjustments = parseAdjustments(adjContent);
      currentParams = parseCurrentParams(adjustments);
    }

    // Read strategy journal
    let strategyJournal = "";
    if (fs.existsSync(JOURNAL_PATH)) {
      strategyJournal = fs.readFileSync(JOURNAL_PATH, "utf-8");
    }

    // Calculate stats
    const resolvedTrades = trades.filter(
      (t) => t.outcome.toLowerCase() === "win" || t.outcome.toLowerCase() === "loss"
    );
    const wins = resolvedTrades.filter((t) => t.outcome.toLowerCase() === "win").length;
    const losses = resolvedTrades.filter((t) => t.outcome.toLowerCase() === "loss").length;
    const totalPnl = resolvedTrades.reduce((sum, t) => sum + t.profit_loss, 0);
    const winRate =
      wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

    const buyTrades = trades.filter(
      (t) => t.action === "BUY" || t.action === "DRY_BUY"
    );
    const totalTrades = buyTrades.length;

    // Cumulative P&L for chart
    const cumulativePnl: Array<{ index: number; pnl: number; timestamp: string }> = [];
    let cumulative = 0;
    resolvedTrades.forEach((trade, index) => {
      cumulative += trade.profit_loss;
      cumulativePnl.push({
        index,
        pnl: cumulative,
        timestamp: trade.timestamp,
      });
    });

    // Get balance from CLOB
    const balance = await fetchClobBalance();

    // Calculate breakdown stats
    const coinStats = calculateCoinStats(trades);
    const hourStats = calculateHourStats(trades);
    const priceBandStats = calculatePriceBandStats(trades);

    // Recent trades (last 30)
    const recentTrades = trades.slice(-30).reverse();

    // Check if dry run — if most recent BUY-type action is DRY_BUY, it's dry run
    const buyActions = trades.filter((t) => t.action === "BUY" || t.action === "DRY_BUY");
    const isDryRun = buyActions.length === 0 || buyActions[buyActions.length - 1].action === "DRY_BUY";

    // Last trade timestamp
    const lastTradeTimestamp = trades.length > 0 ? trades[trades.length - 1].timestamp : null;

    const data: SniperDashboardData = {
      totalPnl,
      winRate,
      totalTrades,
      balance,
      cumulativePnl,
      coinStats,
      hourStats,
      priceBandStats,
      recentTrades,
      currentParams,
      strategyJournal,
      recentAdjustments: adjustments.slice(0, 5),
      isDryRun,
      lastTradeTimestamp,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Sniper API error:", error);
    return NextResponse.json(
      { error: "Failed to load sniper bot data" },
      { status: 500 }
    );
  }
}

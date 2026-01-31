"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/types";

function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPnl(n: number): string {
  const prefix = n >= 0 ? "+" : "";
  return prefix + formatUsd(n);
}

function pnlColor(n: number): string {
  if (n > 0.01) return "text-green-400";
  if (n < -0.01) return "text-red-400";
  return "text-zinc-400";
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function formatTradeTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatChartTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Fetch USDC balance client-side (browser -> Polygon RPC).
// Public RPCs block cloud server IPs (Vercel) but allow browser requests.
const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const RPCS = [
  "https://polygon-rpc.com",
  "https://1rpc.io/matic",
  "https://polygon-bor-rpc.publicnode.com",
];

async function fetchBalanceClientSide(wallet: string): Promise<number> {
  const addr = wallet.replace("0x", "").toLowerCase().padStart(64, "0");
  const calldata = `0x70a08231${addr}`;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [{ to: USDC_CONTRACT, data: calldata }, "latest"],
    id: 1,
  });

  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) continue;
      const json = await res.json();
      const hex = json?.result;
      if (typeof hex === "string" && hex.length > 2) {
        const val = parseInt(hex, 16) / 1e6;
        if (val >= 0) return val;
      }
    } catch {
      continue;
    }
  }
  return 0;
}

// Simple SVG line chart for portfolio value over time
function PortfolioChart({
  history,
}: {
  history: { time: string; value: number }[];
}) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        Collecting data points...
      </div>
    );
  }

  const values = history.map((h) => h.value);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const range = max - min || 1;

  const w = 600;
  const h = 180;
  const padding = 4;

  const points = history.map((d, i) => {
    const x = padding + (i / (history.length - 1)) * (w - padding * 2);
    const y = h - padding - ((d.value - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const first = values[0];
  const last = values[values.length - 1];
  const trend = last >= first ? "#4ade80" : "#f87171";

  // Fill area under the line
  const areaPoints = [
    `${padding},${h - padding}`,
    ...points,
    `${w - padding},${h - padding}`,
  ].join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => {
          const y = h - padding - pct * (h - padding * 2);
          return (
            <line
              key={pct}
              x1={padding}
              y1={y}
              x2={w - padding}
              y2={y}
              stroke="#27272a"
              strokeWidth="1"
            />
          );
        })}
        {/* Filled area */}
        <polygon points={areaPoints} fill={trend} opacity="0.1" />
        {/* Line */}
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={trend}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
        <span>{formatChartTime(history[0].time)}</span>
        <span>{formatChartTime(history[history.length - 1].time)}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<{ time: string; value: number }[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.status === 401 || res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch data");
        return;
      }
      const json: DashboardData = await res.json();
      setData(json);
      setLastUpdated(json.lastUpdated);
      setError("");

      // Fetch USDC balance client-side (browser can reach RPCs that Vercel can't)
      if (json.walletAddress) {
        const bal = await fetchBalanceClientSide(json.walletAddress);
        setCashBalance(bal);
      }

      // Portfolio = cash (from browser RPC) + positions (from API)
      const portfolioTotal = (cashBalance || 0) + json.positionValue;

      // Add to history for chart (keep last 100 points = ~33 minutes)
      setHistory((prev) => {
        const next = [
          ...prev,
          { time: json.lastUpdated, value: portfolioTotal > 0 ? portfolioTotal : json.portfolioValue },
        ];
        return next.slice(-100);
      });
    } catch {
      setError("Connection error");
    }
  }, [router, cashBalance]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!data && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">
          Polymarket Dashboard
        </h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              Updated {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card
              label="Portfolio"
              value={formatUsd(cashBalance + data.positionValue)}
            />
            <Card
              label="Cash"
              value={formatUsd(cashBalance)}
            />
            <Card
              label="Positions"
              value={formatUsd(data.positionValue)}
            />
            <Card
              label="Total P&L"
              value={formatPnl(data.totalPnl)}
              valueClass={pnlColor(data.totalPnl)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card
              label="Win / Loss"
              value={`${data.winCount}W / ${data.lossCount}L`}
              valueClass="text-white"
            />
            <Card
              label="Win Rate"
              value={`${data.winRate.toFixed(0)}%`}
              valueClass={
                data.winRate >= 50 ? "text-green-400" : "text-red-400"
              }
            />
            <Card
              label="Open Positions"
              value={data.totalPositions.toString()}
            />
            <Card
              label="Arb Bets"
              value={data.arbStats.totalSets.toString()}
              valueClass="text-blue-400"
            />
          </div>

          {/* Arb Bot Status */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">Arb Bot</h2>
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/40 text-green-400">
                LIVE
              </span>
            </div>
            {data.arbStats.totalSets === 0 ? (
              <p className="text-zinc-500 text-sm">
                Scanning for arbitrage opportunities. No trades executed yet.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Arb Sets</p>
                    <p className="text-white font-medium">{data.arbStats.totalSets}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Total Legs</p>
                    <p className="text-white font-medium">{data.arbStats.totalLegs}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Total Spent</p>
                    <p className="text-white font-medium">{formatUsd(data.arbStats.totalSpent)}</p>
                  </div>
                </div>
                {data.arbStats.sets.map((set, i) => (
                  <div
                    key={i}
                    className="border-t border-zinc-800 pt-2 text-sm"
                  >
                    <div className="flex justify-between text-zinc-400">
                      <span>{formatTradeTime(set.timestamp)}</span>
                      <span>
                        {set.legs} legs / {formatUsd(set.totalCost)}
                      </span>
                    </div>
                    <div className="text-zinc-500 text-xs mt-1 truncate">
                      {set.outcomes.join(" + ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Portfolio Value
            </h2>
            <PortfolioChart history={history} />
          </div>

          {/* Open Positions */}
          <PositionsTable
            title="Open Positions"
            positions={data.positions.filter(
              (p) => !p.redeemable && p.curPrice > 0 && p.curPrice < 1
            )}
            showResult={false}
          />

          {/* Closed / Resolved Positions */}
          <PositionsTable
            title="Closed Positions"
            positions={data.positions.filter(
              (p) => p.redeemable || p.curPrice === 0 || p.curPrice === 1
            )}
            showResult={true}
          />

          {/* Trade History */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">
                Trade History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 text-left">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Market</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Price
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Shares
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Cost
                    </th>
                    <th className="px-4 py-3 font-medium text-right">
                      Tx
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.trades.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-8 text-center text-zinc-600"
                      >
                        No trades yet
                      </td>
                    </tr>
                  ) : (
                    data.trades.map((t, i) => (
                      <tr
                        key={`${t.transactionHash}-${i}`}
                        className="border-t border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                          {formatTradeTime(t.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-white max-w-[200px] truncate">
                          {t.title}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              t.side === "BUY"
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {t.outcome}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          ${t.price.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {t.size.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatUsd(t.usdcSize)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.transactionHash ? (
                            <a
                              href={`https://polygonscan.com/tx/${t.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
            <span>Auto-refresh: 20s</span>
            {lastUpdated && <span>Last: {timeAgo(lastUpdated)}</span>}
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function PositionsTable({
  title,
  positions,
  showResult,
}: {
  title: string;
  positions: DashboardData["positions"];
  showResult: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg mb-8">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <span className="text-sm text-zinc-500">{positions.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left">
              <th className="px-4 py-3 font-medium">Market</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
              <th className="px-4 py-3 font-medium text-right">Shares</th>
              <th className="px-4 py-3 font-medium text-right">Entry</th>
              <th className="px-4 py-3 font-medium text-right">
                {showResult ? "Exit" : "Current"}
              </th>
              <th className="px-4 py-3 font-medium text-right">P&L</th>
              {showResult && (
                <th className="px-4 py-3 font-medium text-right">Result</th>
              )}
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td
                  colSpan={showResult ? 7 : 6}
                  className="px-4 py-8 text-center text-zinc-600"
                >
                  None
                </td>
              </tr>
            ) : (
              positions.map((p, i) => {
                const won = p.redeemable || p.curPrice === 1;
                return (
                  <tr
                    key={`${p.asset}-${i}`}
                    className="border-t border-zinc-800/50 hover:bg-zinc-800/30"
                  >
                    <td className="px-4 py-3 text-white max-w-[250px] truncate">
                      {p.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          p.outcome === "Up" || p.outcome === "Yes"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {p.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {p.size.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      ${p.avgPrice.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {showResult
                        ? won
                          ? "$1.000"
                          : "$0.000"
                        : `$${p.curPrice.toFixed(3)}`}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${pnlColor(
                        p.cashPnl
                      )}`}
                    >
                      {formatPnl(p.cashPnl)}
                    </td>
                    {showResult && (
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            won
                              ? "bg-green-900/40 text-green-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {won ? "WIN" : "LOSS"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

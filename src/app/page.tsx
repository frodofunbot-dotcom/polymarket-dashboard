"use client";

import { useEffect, useState } from "react";
import { SniperDashboardData } from "@/lib/types";

export default function SniperDashboard() {
  const [data, setData] = useState<SniperDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/sniper", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500">Error: {error || "No data"}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Status Bar */}
      <div className="mb-6 flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">SNIPER BOT</h1>
          {data.isDryRun ? (
            <span className="px-3 py-1 bg-yellow-900/30 text-yellow-400 text-sm font-mono border border-yellow-700 rounded">
              DRY RUN
            </span>
          ) : (
            <span className="px-3 py-1 bg-green-900/30 text-green-400 text-sm font-mono border border-green-700 rounded">
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          {data.lastTradeTimestamp && (
            <div>
              Last trade: {new Date(data.lastTradeTimestamp).toLocaleString()}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Auto-refresh 10s</span>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total P&L"
          value={`$${data.totalPnl.toFixed(2)}`}
          valueColor={data.totalPnl >= 0 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          label="Win Rate"
          value={`${data.winRate.toFixed(1)}%`}
          valueColor={data.winRate >= 50 ? "text-green-400" : "text-red-400"}
        />
        <StatCard
          label="Total Trades"
          value={data.totalTrades.toString()}
          valueColor="text-white"
        />
        <StatCard
          label="Balance"
          value={`$${data.balance.toFixed(2)}`}
          valueColor="text-blue-400"
        />
      </div>

      {/* P&L Chart */}
      {data.cumulativePnl.length > 0 && (
        <div className="mb-6 border border-gray-800 rounded-lg p-6 bg-black/50">
          <h2 className="text-lg font-bold mb-4">CUMULATIVE P&L</h2>
          <PnLChart data={data.cumulativePnl} />
        </div>
      )}

      {/* Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* By Coin */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
          <h3 className="text-sm font-bold mb-3 text-gray-400">BY COIN</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs">
                  <th className="pb-2">Coin</th>
                  <th className="pb-2 text-right">Trades</th>
                  <th className="pb-2 text-right">W/L</th>
                  <th className="pb-2 text-right">WR%</th>
                  <th className="pb-2 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {data.coinStats.map((stat) => (
                  <tr key={stat.coin} className="border-t border-gray-800">
                    <td className="py-2 font-mono text-xs">{stat.coin}</td>
                    <td className="py-2 text-right">{stat.trades}</td>
                    <td className="py-2 text-right">
                      <span className="text-green-400">{stat.wins}</span>/
                      <span className="text-red-400">{stat.losses}</span>
                    </td>
                    <td className="py-2 text-right">
                      {stat.winRate.toFixed(0)}%
                    </td>
                    <td
                      className={`py-2 text-right font-mono ${
                        stat.pnl >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      ${stat.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Hour */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
          <h3 className="text-sm font-bold mb-3 text-gray-400">BY HOUR (UTC)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs">
                  <th className="pb-2">Hour</th>
                  <th className="pb-2 text-right">Trades</th>
                  <th className="pb-2 text-right">W/L</th>
                  <th className="pb-2 text-right">WR%</th>
                </tr>
              </thead>
              <tbody>
                {data.hourStats.map((stat) => (
                  <tr key={stat.hour} className="border-t border-gray-800">
                    <td className="py-2 font-mono">
                      {stat.hour.toString().padStart(2, "0")}:00
                    </td>
                    <td className="py-2 text-right">{stat.trades}</td>
                    <td className="py-2 text-right">
                      <span className="text-green-400">{stat.wins}</span>/
                      <span className="text-red-400">{stat.losses}</span>
                    </td>
                    <td className="py-2 text-right">
                      {stat.winRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Price Band */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
          <h3 className="text-sm font-bold mb-3 text-gray-400">BY PRICE BAND</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs">
                  <th className="pb-2">Band</th>
                  <th className="pb-2 text-right">Trades</th>
                  <th className="pb-2 text-right">W/L</th>
                  <th className="pb-2 text-right">WR%</th>
                </tr>
              </thead>
              <tbody>
                {data.priceBandStats.map((stat) => (
                  <tr key={stat.band} className="border-t border-gray-800">
                    <td className="py-2 font-mono text-xs">{stat.band}</td>
                    <td className="py-2 text-right">{stat.trades}</td>
                    <td className="py-2 text-right">
                      <span className="text-green-400">{stat.wins}</span>/
                      <span className="text-red-400">{stat.losses}</span>
                    </td>
                    <td className="py-2 text-right">
                      {stat.winRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      <div className="mb-6 border border-gray-800 rounded-lg p-4 bg-black/50">
        <h2 className="text-lg font-bold mb-4">RECENT TRADES (Last 30)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Coin</th>
                <th className="pb-2">Side</th>
                <th className="pb-2 text-right">Price</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">Time Left</th>
                <th className="pb-2 text-right">Spread</th>
                <th className="pb-2">Outcome</th>
                <th className="pb-2 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTrades.map((trade, idx) => (
                <tr key={idx} className="border-t border-gray-800">
                  <td className="py-2 font-mono text-xs">
                    {new Date(trade.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2 font-mono text-xs">{trade.coin}</td>
                  <td className="py-2">
                    <span
                      className={
                        trade.side === "YES"
                          ? "text-green-400"
                          : "text-red-400"
                      }
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {trade.entry_price.toFixed(3)}
                  </td>
                  <td className="py-2 text-right">${trade.amount_usdc.toFixed(0)}</td>
                  <td className="py-2 text-right font-mono text-xs">
                    {trade.time_remaining >= 60
                      ? `${Math.floor(trade.time_remaining / 60)}m ${Math.round(trade.time_remaining % 60)}s`
                      : `${Math.round(trade.time_remaining)}s`}
                  </td>
                  <td className="py-2 text-right font-mono text-xs">${trade.spread.toFixed(3)}</td>
                  <td className="py-2">
                    <span
                      className={
                        trade.outcome.toLowerCase() === "win"
                          ? "text-green-400"
                          : trade.outcome.toLowerCase() === "loss"
                          ? "text-red-400"
                          : "text-yellow-400"
                      }
                    >
                      {trade.outcome.toUpperCase()}
                    </span>
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${
                      trade.profit_loss >= 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    ${trade.profit_loss.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Brain Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Parameters */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
          <h2 className="text-lg font-bold mb-4">CURRENT PARAMETERS</h2>
          <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
            {JSON.stringify(data.currentParams, null, 2)}
          </pre>
        </div>

        {/* Recent AI Adjustments */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
          <h2 className="text-lg font-bold mb-4">RECENT AI ADJUSTMENTS</h2>
          <div className="space-y-3">
            {data.recentAdjustments.map((adj, idx) => (
              <div key={idx} className="text-xs">
                <div className="text-gray-500 mb-1">{adj.timestamp}</div>
                <div className="text-gray-300 whitespace-pre-wrap font-mono">
                  {adj.content.split("\n").slice(1).join("\n")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Journal */}
        <div className="border border-gray-800 rounded-lg p-4 bg-black/50 lg:col-span-2">
          <h2 className="text-lg font-bold mb-4">STRATEGY JOURNAL</h2>
          <div className="prose prose-invert prose-sm max-w-none">
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
              {data.strategyJournal}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <div className="border border-gray-800 rounded-lg p-4 bg-black/50">
      <div className="text-sm text-gray-400 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}

function PnLChart({
  data,
}: {
  data: Array<{ index: number; pnl: number; timestamp: string }>;
}) {
  if (data.length === 0) return null;

  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 60 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxIndex = data.length - 1;
  const minPnl = Math.min(0, ...data.map((d) => d.pnl));
  const maxPnl = Math.max(0, ...data.map((d) => d.pnl));
  const pnlRange = maxPnl - minPnl;

  const points = data
    .map((d) => {
      const x = (d.index / maxIndex) * chartWidth + padding.left;
      const y =
        height -
        padding.bottom -
        ((d.pnl - minPnl) / pnlRange) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const finalPnl = data[data.length - 1].pnl;
  const lineColor = finalPnl >= 0 ? "#4ade80" : "#f87171";

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxWidth: "100%" }}
      >
        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth="1"
        />
        {/* X-axis */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#374151"
          strokeWidth="1"
        />
        {/* Zero line */}
        {minPnl < 0 && maxPnl > 0 && (
          <line
            x1={padding.left}
            y1={
              height - padding.bottom - (-minPnl / pnlRange) * chartHeight
            }
            x2={width - padding.right}
            y2={
              height - padding.bottom - (-minPnl / pnlRange) * chartHeight
            }
            stroke="#4b5563"
            strokeWidth="1"
            strokeDasharray="4"
          />
        )}
        {/* P&L line */}
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
        />
        {/* Y-axis labels */}
        <text
          x={padding.left - 10}
          y={padding.top}
          textAnchor="end"
          fill="#9ca3af"
          fontSize="12"
        >
          ${maxPnl.toFixed(0)}
        </text>
        <text
          x={padding.left - 10}
          y={height - padding.bottom}
          textAnchor="end"
          fill="#9ca3af"
          fontSize="12"
        >
          ${minPnl.toFixed(0)}
        </text>
        {/* X-axis label */}
        <text
          x={width / 2}
          y={height - 5}
          textAnchor="middle"
          fill="#9ca3af"
          fontSize="12"
        >
          Trade Number
        </text>
      </svg>
    </div>
  );
}

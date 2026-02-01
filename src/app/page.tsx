"use client";

import { useEffect, useState, useCallback } from "react";
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
  if (n > 0.005) return "text-green-400";
  if (n < -0.005) return "text-red-400";
  return "text-zinc-400";
}

function pnlBg(n: number): string {
  if (n > 0.005) return "bg-green-500/10 border-green-500/20";
  if (n < -0.005) return "bg-red-500/10 border-red-500/20";
  return "bg-zinc-800/50 border-zinc-700/50";
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
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [, setTick] = useState(0);
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
    } catch {
      setError("Connection error");
    }
  }, [router]);

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
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">P&L Tracker</h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-zinc-500">
              {timeAgo(lastUpdated)}
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
          {/* Big P&L Hero */}
          <div
            className={`rounded-xl border p-6 mb-6 text-center ${pnlBg(
              data.todayPnl
            )}`}
          >
            <p className="text-sm text-zinc-400 uppercase tracking-wider mb-2">
              Today&apos;s P&amp;L
            </p>
            <p
              className={`text-4xl font-bold ${pnlColor(data.todayPnl)}`}
            >
              {formatPnl(data.todayPnl)}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <Card label="Portfolio" value={formatUsd(data.portfolioValue)} />
            <Card label="Cash" value={formatUsd(data.balance)} />
            <Card
              label="Wins"
              value={data.todayWins.toString()}
              valueClass="text-green-400"
            />
            <Card
              label="Losses"
              value={data.todayLosses.toString()}
              valueClass="text-red-400"
            />
            <Card
              label="Win Rate"
              value={
                data.todayWins + data.todayLosses > 0
                  ? `${data.todayWinRate.toFixed(0)}%`
                  : "--"
              }
              valueClass={
                data.todayWinRate >= 50
                  ? "text-green-400"
                  : data.todayWins + data.todayLosses > 0
                  ? "text-red-400"
                  : "text-zinc-400"
              }
            />
          </div>

          {/* Open Positions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg mb-6">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Open Positions
              </h2>
              <span className="text-sm text-zinc-500">
                {data.openPositions.length}
              </span>
            </div>
            {data.openPositions.length === 0 ? (
              <div className="px-4 py-6 text-center text-zinc-600 text-sm">
                No open positions
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {data.openPositions.map((p, i) => (
                  <div
                    key={`${p.asset}-${i}`}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm text-white truncate">{p.title}</p>
                      <p className="text-xs text-zinc-500">
                        {p.outcome} &middot; {p.size.toFixed(2)} shares @
                        ${p.avgPrice.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-medium ${pnlColor(p.cashPnl)}`}
                      >
                        {formatPnl(p.cashPnl)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        now ${p.curPrice.toFixed(3)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Trades */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Today&apos;s Trades
              </h2>
              <span className="text-sm text-zinc-500">
                {data.todayTrades.length}
              </span>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {data.todayTrades.length === 0 ? (
                <div className="px-4 py-6 text-center text-zinc-600 text-sm">
                  No trades yet today
                </div>
              ) : (
                data.todayTrades.map((t, i) => (
                  <div
                    key={`${t.transactionHash}-${i}`}
                    className="px-4 py-3 flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${
                            t.side === "BUY"
                              ? "bg-green-900/40 text-green-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {t.side}
                        </span>
                        <span className="text-sm text-white truncate">
                          {t.title}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {formatTradeTime(t.timestamp)} &middot; {t.outcome}{" "}
                        &middot; {t.size.toFixed(2)} @ ${t.price.toFixed(3)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-zinc-300">
                        {formatUsd(t.usdcSize)}
                      </p>
                      {t.transactionHash && (
                        <a
                          href={`https://polygonscan.com/tx/${t.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          tx
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 text-center text-xs text-zinc-600">
            Auto-refresh 20s
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

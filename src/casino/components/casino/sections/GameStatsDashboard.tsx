"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Trophy, Percent } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/types";
import { useUIStore } from "@/lib/store";
import { GameDetailModal } from "../GameDetailModal";

interface GameStat {
  gameId: string;
  gameName: string;
  gameCategory: string;
  betCount: number;
  totalWagered: number;
  totalPaidOut: number;
  houseProfit: number;
  houseEdge: number;
  winRate: number;
  biggestMultiplier: number;
  uniquePlayers: number;
}

interface StatsData {
  games: GameStat[];
  totals: {
    totalBets: number;
    totalWagered: number;
    totalPaidOut: number;
    houseProfit: number;
    totalPlayers: number;
  };
}

const PIE_COLORS = ["var(--color-lime)", "var(--color-vip)", "#3b82f6", "var(--color-pending)", "#10b981", "#ec4899", "var(--color-loss)", "#06b6d4"];

export function GameStatsDashboard() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data } = useQuery<StatsData>({
    queryKey: ["game-stats"],
    queryFn: async () => {
      const r = await fetch("/api/game-stats");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 30000,
  });

  const openGameDetail = (gameId: string) => {
    setSelectedGame(gameId);
    setModalOpen(true);
  };

  const games = data?.games || [];
  const totals = data?.totals;

  // Chart data: top 6 games by wagered
  const chartData = games.slice(0, 6).map((g) => ({
    name: g.gameName,
    Wagered: Math.round(g.totalWagered),
    "Paid Out": Math.round(g.totalPaidOut),
    Profit: Math.round(g.houseProfit),
  }));

  // Pie data: wagered by category
  const categoryMap = new Map<string, number>();
  for (const g of games) {
    categoryMap.set(g.gameCategory, (categoryMap.get(g.gameCategory) || 0) + g.totalWagered);
  }
  const pieData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <BarChart3 className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Game Stats</h1>
          <p className="text-xs text-muted-foreground">Platform-wide analytics: RTP, house edge, wagered, and more.</p>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Bets" value={formatNumber(totals?.totalBets || 0)} icon={Activity} color="var(--color-lime)" />
        <StatCard label="Total Wagered" value={formatCurrency(totals?.totalWagered || 0)} icon={DollarSign} />
        <StatCard label="Total Paid Out" value={formatCurrency(totals?.totalPaidOut || 0)} icon={TrendingUp} color="#10b981" />
        <StatCard label="House Profit" value={formatCurrency(totals?.houseProfit || 0)} icon={Trophy} color={totals && totals.houseProfit >= 0 ? "var(--color-lime)" : "var(--color-loss)"} />
        <StatCard label="Unique Players" value={formatNumber(totals?.totalPlayers || 0)} icon={Users} color="var(--color-vip)" />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Bar chart: wagered vs paid out vs profit */}
        <div className="rounded-lg border border-border/50 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Top Games by Volume</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "#8a8f9c", fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#8a8f9c", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#181b26", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-lime)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Wagered" fill="var(--color-lime)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Paid Out" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Profit" fill="var(--color-vip)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
        </div>

        {/* Pie chart: wagered by category */}
        <div className="rounded-lg border border-border/50 bg-card/40 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Wagered by Category</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 10 }}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#181b26", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
          )}
        </div>
      </div>

      {/* Full stats table */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
        <div className="border-b border-border/40 px-3 py-2">
          <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Per-Game Breakdown ({games.length} games)
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Game</th>
                <th className="px-3 py-2 text-right font-semibold">Bets</th>
                <th className="px-3 py-2 text-right font-semibold">Wagered</th>
                <th className="px-3 py-2 text-right font-semibold">Paid Out</th>
                <th className="px-3 py-2 text-right font-semibold">House Edge</th>
                <th className="px-3 py-2 text-right font-semibold">Win Rate</th>
                <th className="px-3 py-2 text-right font-semibold">Biggest Mult</th>
                <th className="px-3 py-2 text-right font-semibold">Players</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr
                  key={g.gameId}
                  onClick={() => openGameDetail(g.gameId)}
                  className="cursor-pointer border-t border-border/30 transition-colors hover:border-lime/30 hover:bg-lime/5"
                  style={undefined}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium hover:text-lime" style={undefined}>{g.gameName}</div>
                    <div className="text-[9px] uppercase text-muted-foreground">{g.gameCategory}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(g.betCount)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(g.totalWagered)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-green-400">{formatCurrency(g.totalPaidOut)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: g.houseEdge >= 0 ? "var(--color-lime)" : "var(--color-loss)" }}>
                    {g.houseEdge.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{g.winRate.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: "var(--color-pending)" }}>
                    {g.biggestMultiplier > 0 ? `${g.biggestMultiplier.toFixed(2)}×` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{g.uniquePlayers}</td>
                </tr>
              ))}
              {games.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-xs text-muted-foreground">No bets placed yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Game detail modal */}
      <GameDetailModal
        gameId={selectedGame}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onPlay={(slug) => {
          // Navigate to the game — use window.location to trigger page change
          useUIStore.getState().setSelectedGame(slug);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className=" text-lg font-bold" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

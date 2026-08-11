"use client";

import { useQuery } from "@tanstack/react-query";
import { X, TrendingUp, Users, DollarSign, Percent, Activity, Trophy, BarChart3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/types";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GameDetail {
  game: {
    name: string;
    provider: string;
    category: string;
    rtp: number;
    volatility: string;
    image: string;
    description: string;
  };
  stats: {
    totalBets: number;
    totalWagered: number;
    totalPaidOut: number;
    houseProfit: number;
    houseEdge: number;
    winRate: number;
    wins: number;
    losses: number;
    uniquePlayers: number;
    biggestMultiplier: number;
  };
  topMultipliers: Array<{
    username: string;
    avatarColor: string;
    multiplier: number;
    payout: number;
    amount: number;
    createdAt: string;
  }>;
  betDistribution: Array<{ label: string; count: number }>;
  recentBets: Array<{
    username: string;
    avatarColor: string;
    amount: number;
    multiplier: number;
    payout: number;
    result: string;
    createdAt: string;
  }>;
}

const BAR_COLORS = ["var(--win)", "var(--vip)", "var(--pending)", "var(--loss)", "var(--lime-500)", "var(--lime-200)"];

export function GameDetailModal({
  gameId,
  open,
  onOpenChange,
  onPlay,
}: {
  gameId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPlay?: (gameId: string) => void;
}) {
  const { data } = useQuery<GameDetail>({
    queryKey: ["game-detail", gameId],
    queryFn: async () => {
      const r = await fetch(`/api/game-stats/${gameId}`);
      const j = await r.json();
      return j.data;
    },
    enabled: !!gameId && open,
  });

  if (!data) return null;

  const { game, stats, topMultipliers, betDistribution, recentBets } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-border/60 bg-popover/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 text-xl font-bold uppercase tracking-wide">
            <div className="flex items-center gap-2">
              {game.image && <img src={game.image} alt={game.name} className="h-8 w-8 rounded" />}
              {game.name}
              <span className="rounded bg-lime/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-lime">
                {game.category}
              </span>
            </div>
            {game.category === "originals" && onPlay && gameId && (
              <Button
                onClick={() => {
                  onPlay(gameId);
                  onOpenChange(false);
                }}
                size="sm"
                className="btn-press bg-lime text-xs font-semibold uppercase tracking-wide text-bg hover:bg-lime-200"
              >
                <Play className="mr-1 h-3.5 w-3.5 fill-current" /> Play Now
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Game info */}
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded border border-border/50 bg-background/40 p-2">
            <div className="text-[9px] uppercase text-muted-foreground">Provider</div>
            <div className="font-semibold">{game.provider}</div>
          </div>
          <div className="rounded border border-border/50 bg-background/40 p-2">
            <div className="text-[9px] uppercase text-muted-foreground">RTP</div>
            <div className="font-mono font-bold tabular-nums text-lime">{game.rtp}%</div>
          </div>
          <div className="rounded border border-border/50 bg-background/40 p-2">
            <div className="text-[9px] uppercase text-muted-foreground">Volatility</div>
            <div className="font-semibold capitalize">{game.volatility}</div>
          </div>
          <div className="rounded border border-border/50 bg-background/40 p-2">
            <div className="text-[9px] uppercase text-muted-foreground">House Edge</div>
            <div className={`font-mono font-bold tabular-nums ${stats.houseEdge >= 0 ? "text-lime" : "text-loss"}`}>
              {stats.houseEdge.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatMini label="Total Bets" value={formatNumber(stats.totalBets)} icon={Activity} />
          <StatMini label="Wagered" value={formatCurrency(stats.totalWagered)} icon={DollarSign} />
          <StatMini label="Paid Out" value={formatCurrency(stats.totalPaidOut)} icon={TrendingUp} color="var(--win)" />
          <StatMini label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} icon={Percent} />
          <StatMini label="Wins" value={formatNumber(stats.wins)} icon={Trophy} color="var(--win)" />
          <StatMini label="Losses" value={formatNumber(stats.losses)} icon={X} color="var(--loss)" />
          <StatMini label="Players" value={formatNumber(stats.uniquePlayers)} icon={Users} color="var(--vip)" />
          <StatMini label="Biggest Mult" value={`${stats.biggestMultiplier.toFixed(2)}×`} icon={TrendingUp} color="var(--pending)" />
        </div>

        {/* Bet distribution chart */}
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <BarChart3 className="h-3.5 w-3.5" /> Bet Size Distribution
          </h4>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={betDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fill: "#8a8f9c", fontSize: 9 }} />
              <YAxis tick={{ fill: "#8a8f9c", fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: "var(--overlay)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)", borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {betDistribution.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top multipliers */}
        {topMultipliers.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-background/40 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
              <Trophy className="h-3.5 w-3.5 text-pending" /> Top Multipliers
            </h4>
            <div className="space-y-1">
              {topMultipliers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-center font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: m.avatarColor, color: "var(--color-bg)" }}>
                    {m.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate font-medium">{m.username}</span>
                  <span className="font-mono text-muted-foreground">{formatCurrency(m.amount)}</span>
                  <span className="font-mono font-bold text-pending">{m.multiplier.toFixed(2)}×</span>
                  <span className="w-16 text-right font-mono font-bold text-lime">{formatCurrency(m.payout)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent bets */}
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <Activity className="h-3.5 w-3.5" /> Recent Bets
          </h4>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {recentBets.map((b, i) => {
              const won = b.result === "win";
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: b.avatarColor, color: "var(--color-bg)" }}>
                    {b.username.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate font-medium">{b.username}</span>
                  <span className="font-mono text-muted-foreground">{formatCurrency(b.amount)}</span>
                  <span className={`font-mono font-bold ${won ? "text-lime" : "text-muted-foreground"}`}>
                    {b.multiplier > 0 ? `${b.multiplier.toFixed(2)}×` : "—"}
                  </span>
                  <span className={`w-16 text-right font-mono font-bold ${won ? "text-win" : "text-loss"}`}>
                    {won ? "+" + formatCurrency(b.payout) : "—"}
                  </span>
                  <span className="w-12 text-right text-[9px] text-muted-foreground">{timeAgo(b.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatMini({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color?: string }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 p-2">
      <div className="mb-0.5 flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[8px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-sm font-bold" style={color ? { color } : {}}>{value}</div>
    </div>
  );
}

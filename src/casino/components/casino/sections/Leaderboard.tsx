"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Crown, TrendingUp, Users, DollarSign, Flame, ChevronRight, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, timeAgo } from "@/lib/types";
import { useUIStore } from "@/lib/store";
import { toast } from "sonner";

interface LeaderEntry {
  rank: number;
  userId: string;
  username: string;
  avatarColor: string;
  level: number;
  wagered: number;
  wins: number;
  losses: number;
  biggestWin: number;
  totalWon: number;
  netProfit: number;
  betCount: number;
}

const METRICS = [
  { id: "wagered", label: "Most Wagered", icon: DollarSign },
  { id: "wins", label: "Most Wins", icon: Trophy },
  { id: "biggest_win", label: "Biggest Win", icon: Flame },
  { id: "profit", label: "Top Profit", icon: TrendingUp },
];

const PERIODS = [
  { id: "all", label: "All Time" },
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Today" },
];

export function Leaderboard() {
  const { setActiveSection } = useUIStore();
  const qc = useQueryClient();
  const [metric, setMetric] = useState("wagered");
  const [period, setPeriod] = useState("all");

  const { data } = useQuery<{ total: number; leaderboard: LeaderEntry[] }>({
    queryKey: ["leaderboard", metric, period],
    queryFn: async () => {
      const r = await fetch(`/api/leaderboard?metric=${metric}&period=${period}&limit=50`);
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 15000,
  });

  // Load followed users
  const { data: socialData } = useQuery<{ followed: { id: string }[] }>({
    queryKey: ["social"],
    queryFn: async () => {
      const r = await fetch("/api/social");
      const j = await r.json();
      return j.data;
    },
  });

  // Derive followed set from social data (no setState-in-effect)
  const followedIds = new Set((socialData?.followed || []).map((f) => f.id));

  const followMutation = useMutation({
    mutationFn: async (vars: { userId: string; action: "follow" | "unfollow" }) => {
      const r = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (data) => {
      toast.success(data.action === "follow" ? `Now following ${data.username}` : `Unfollowed ${data.username}`);
      qc.invalidateQueries({ queryKey: ["social"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = data?.leaderboard || [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const formatValue = (e: LeaderEntry) => {
    if (metric === "wagered") return formatCurrency(e.wagered);
    if (metric === "wins") return formatNumber(e.wins);
    if (metric === "biggest_win") return formatCurrency(e.biggestWin);
    if (metric === "profit") return (e.netProfit >= 0 ? "+" : "") + formatCurrency(e.netProfit);
    return formatCurrency(e.wagered);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Trophy className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Global Leaderboard</h1>
          <p className="text-xs text-muted-foreground">Top players across all TOLS games. Updated live.</p>
        </div>
      </div>

      {/* Metric + period filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const active = metric === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "border-lime/40 bg-lime/10 text-lime" : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
                style={active ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
              >
                <Icon className="h-3.5 w-3.5" /> {m.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                period === p.id ? "border-lime/40 bg-lime/10 text-lime" : "border-border/50 text-muted-foreground"
              }`}
              style={period === p.id ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(() => {
            // Reorder: 2nd, 1st, 3rd for podium visual
            const order = [top3[1], top3[0], top3[2]];
            return order.map((e, idx) => {
              const realRank = e.rank;
              const isFirst = realRank === 1;
              const medal = realRank === 1 ? "🥇" : realRank === 2 ? "🥈" : "🥉";
              const borderColor = realRank === 1 ? "var(--color-pending)" : realRank === 2 ? "var(--color-muted-foreground)" : "#d97706";
              const heightClass = isFirst ? "sm:mt-0" : "sm:mt-4";
              return (
                <div
                  key={e.userId}
                  className={`relative overflow-hidden rounded-xl border p-4 ${heightClass}`}
                  style={{
                    borderColor: borderColor + "60",
                    background: `linear-gradient(135deg, ${borderColor}15, transparent)`,
                    boxShadow: isFirst ? `0 0 24px ${borderColor}30` : "none",
                  }}
                >
                  <div className="absolute right-2 top-2 text-2xl">{medal}</div>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: e.avatarColor, color: "var(--color-bg)", width: isFirst ? 48 : 40, height: isFirst ? 48 : 40 }}
                    >
                      {e.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{e.username}</div>
                      <div className="text-xs text-muted-foreground">Level {e.level} · {e.betCount} bets</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {METRICS.find((m) => m.id === metric)?.label}
                    </div>
                    <div className=" text-2xl font-bold" style={{ color: borderColor }}>
                      {formatValue(e)}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Full table */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
        <div className="border-b border-border/40 px-3 py-2">
          <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Ranking · {data?.total || 0} players
          </span>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 text-right font-semibold">Bets</th>
                <th className="px-3 py-2 text-right font-semibold">Win Rate</th>
                <th className="px-3 py-2 text-right font-semibold">{METRICS.find((m) => m.id === metric)?.label}</th>
                <th className="px-3 py-2 text-right font-semibold">Follow</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((e) => {
                const winRate = e.betCount > 0 ? (e.wins / e.betCount) * 100 : 0;
                const isFollowing = followedIds.has(e.userId);
                return (
                  <tr key={e.userId} className="border-t border-border/30 transition-colors hover:bg-secondary/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{e.rank}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: e.avatarColor, color: "var(--color-bg)" }}>
                          {e.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{e.username}</span>
                        <span className="rounded bg-secondary/50 px-1 text-[8px] uppercase text-muted-foreground">Lvl {e.level}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(e.betCount)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{winRate.toFixed(0)}%</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: metric === "profit" ? (e.netProfit >= 0 ? "var(--color-lime)" : "var(--color-loss)") : "var(--color-lime)" }}>
                      {formatValue(e)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => followMutation.mutate({ userId: e.userId, action: isFollowing ? "unfollow" : "follow" })}
                        className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase transition-colors ${
                          isFollowing
                            ? "border-lime/40 bg-lime/10 text-lime"
                            : "border-border/60 text-muted-foreground hover:border-lime/40 hover:text-lime"
                        }`}
                        style={isFollowing ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
                      >
                        {isFollowing ? <UserCheck className="h-2.5 w-2.5" /> : <UserPlus className="h-2.5 w-2.5" />}
                        {isFollowing ? "Following" : "Follow"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-xs text-muted-foreground">
                    No data for this period yet. Start playing to appear on the leaderboard!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 p-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{data?.total || 0} players ranked this period</p>
        </div>
        <Button onClick={() => setActiveSection("originals")} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
          Play to Climb <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

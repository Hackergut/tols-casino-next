"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy, Crown, TrendingUp, Gamepad2 } from "lucide-react";
import { formatCurrency, timeAgo } from "@/lib/types";
import { useUIStore } from "@/lib/store";

interface Winner {
  id: string;
  username: string;
  avatarColor: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  createdAt: string;
}

export function Winners() {
  const { setActiveSection } = useUIStore();

  const { data: winners } = useQuery<Winner[]>({
    queryKey: ["winners"],
    queryFn: async () => {
      const r = await fetch("/api/winners");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 15000,
  });

  const sorted = [...(winners || [])].sort((a, b) => b.payout - a.payout);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const totalPaid = sorted.reduce((s, w) => s + w.payout, 0);
  const biggestWin = sorted[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Trophy className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Biggest Wins</h1>
          <p className="text-xs text-muted-foreground">The biggest payouts across all TOLS games.</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Total Paid Out</span>
          </div>
          <div className=" text-xl font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(totalPaid)}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Biggest Single Win</span>
          </div>
          <div className=" text-xl font-bold">{biggestWin ? formatCurrency(biggestWin.payout) : "—"}</div>
        </div>
        <div className="col-span-2 rounded-lg border border-border/50 bg-card/40 p-3 sm:col-span-1">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Winning Games</span>
          </div>
          <div className=" text-xl font-bold">{sorted.length}</div>
        </div>
      </div>

      {/* Top 3 podium */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {top3.map((w, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
            const borderColor = i === 0 ? "var(--color-pending)" : i === 1 ? "var(--color-muted-foreground)" : "#d97706";
            return (
              <div
                key={w.id}
                className="relative overflow-hidden rounded-xl border p-4"
                style={{
                  borderColor: borderColor + "60",
                  background: `linear-gradient(135deg, ${borderColor}15, transparent)`,
                  boxShadow: i === 0 ? `0 0 24px ${borderColor}30` : "none",
                }}
              >
                <div className="absolute right-2 top-2 text-2xl">{medal}</div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
                    style={{ background: w.avatarColor, color: "var(--color-bg)" }}
                  >
                    {w.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{w.username}</div>
                    <div className="text-xs text-muted-foreground">{w.gameName}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Payout</div>
                    <div className=" text-2xl font-bold" style={{ color: "var(--color-lime)" }}>
                      {formatCurrency(w.payout)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Multiplier</div>
                    <div className="font-mono text-lg font-bold" style={{ color: borderColor }}>
                      {w.multiplier.toFixed(2)}×
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">{timeAgo(w.createdAt)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
        <div className="border-b border-border/40 px-3 py-2">
          <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            All Big Winners ({sorted.length})
          </span>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 font-semibold">Game</th>
                <th className="px-3 py-2 text-right font-semibold">Bet</th>
                <th className="px-3 py-2 text-right font-semibold">Multiplier</th>
                <th className="px-3 py-2 text-right font-semibold">Payout</th>
                <th className="px-3 py-2 text-right font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((w, i) => (
                <tr key={w.id} className="border-t border-border/30 transition-colors hover:bg-secondary/30">
                  <td className="px-3 py-2">
                    {i < 3 ? (
                      <span className="flex h-5 w-5 items-center justify-center text-xs">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: w.avatarColor, color: "var(--color-bg)" }}>
                        {w.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{w.username}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{w.gameName}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(w.amount)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: "var(--color-lime)" }}>{w.multiplier.toFixed(2)}×</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(w.payout)}</td>
                  <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">{timeAgo(w.createdAt)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-xs text-muted-foreground">
                    No big winners yet. Start playing to be the first!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-center gap-3 rounded-lg border border-border/50 bg-card/30 p-4">
        <Crown className="h-5 w-5" style={{ color: "var(--color-lime)" }} />
        <p className="text-sm text-muted-foreground">
          Think you can beat these? Every bet feeds the Mega Drop jackpot.
        </p>
        <button
          onClick={() => setActiveSection("originals")}
          className="rounded-md px-4 py-2 text-sm font-semibold uppercase tracking-wide"
          style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
        >
          Play Now
        </button>
      </div>
    </div>
  );
}

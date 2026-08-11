"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { History, TrendingUp, TrendingDown, Filter, Loader2, ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, timeAgo } from "@/lib/types";
import { useUIStore } from "@/lib/store";

interface BetHistoryItem {
  id: string;
  gameId: string;
  gameName: string;
  gameCategory: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: "win" | "lose";
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  createdAt: string;
}

const GAME_FILTERS = [
  { value: "all", label: "All Games" },
  { value: "dice", label: "Dice" },
  { value: "crash", label: "Crash" },
  { value: "plinko", label: "Plinko" },
  { value: "mines", label: "Mines" },
  { value: "limbo", label: "Limbo" },
  { value: "coinflip", label: "Coin Flip" },
  { value: "wheel", label: "Wheel" },
];

const PAGE_SIZE = 20;

export function BetHistory() {
  const [game, setGame] = useState("all");
  const [result, setResult] = useState("all");
  const [page, setPage] = useState(0);
  const { setProvablyFairOpen } = useUIStore();

  const { data, isLoading } = useQuery<{ total: number; bets: BetHistoryItem[] }>({
    queryKey: ["bet-history", game, result, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (game !== "all") params.set("game", game);
      if (result !== "all") params.set("result", result);
      params.set("limit", String(PAGE_SIZE));
      params.set("skip", String(page * PAGE_SIZE));
      const r = await fetch(`/api/bets/history?${params}`);
      const j = await r.json();
      return j.data;
    },
  });

  const bets = data?.bets || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const wins = bets.filter((b) => b.result === "win").length;
  const totalWagered = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.reduce((s, b) => s + b.payout, 0);
  const netProfit = totalWon - totalWagered;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <History className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Bet History</h1>
          <p className="text-xs text-muted-foreground">Your complete betting record. Verify any bet's fairness.</p>
        </div>
      </div>

      {/* Stats for current page */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Bets" value={total.toString()} icon={History} />
        <StatCard label="Page Wins" value={`${wins}/${bets.length}`} icon={TrendingUp} color="var(--color-lime)" />
        <StatCard label="Wagered" value={formatCurrency(totalWagered)} icon={TrendingDown} />
        <StatCard label="Net Profit" value={`${netProfit >= 0 ? "+" : ""}${formatCurrency(netProfit)}`} icon={netProfit >= 0 ? TrendingUp : TrendingDown} color={netProfit >= 0 ? "var(--color-lime)" : "var(--color-loss)"} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={game} onValueChange={(v) => { setGame(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GAME_FILTERS.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={(v) => { setResult(v); setPage(0); }}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="win">Wins Only</SelectItem>
            <SelectItem value="lose">Losses Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/50 bg-card/40">
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Game</th>
                <th className="px-3 py-2 text-right font-semibold">Bet</th>
                <th className="px-3 py-2 text-right font-semibold">Mult</th>
                <th className="px-3 py-2 text-right font-semibold">Payout</th>
                <th className="px-3 py-2 font-semibold">Result</th>
                <th className="px-3 py-2 text-right font-semibold">When</th>
                <th className="px-3 py-2 text-right font-semibold">Verify</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : bets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-xs text-muted-foreground">
                    No bets found matching these filters.
                  </td>
                </tr>
              ) : (
                bets.map((b) => {
                  const won = b.result === "win";
                  return (
                    <tr key={b.id} className="border-t border-border/30 transition-colors hover:bg-secondary/30">
                      <td className="px-3 py-2">
                        <div className="font-medium">{b.gameName}</div>
                        <div className="text-[9px] uppercase text-muted-foreground">{b.gameCategory}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{formatCurrency(b.amount)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: won ? "var(--color-lime)" : "var(--color-muted-foreground)" }}>
                        {b.multiplier > 0 ? `${b.multiplier.toFixed(2)}×` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold" style={{ color: won ? "var(--color-lime)" : "var(--color-muted-foreground)" }}>
                        {won ? "+" + formatCurrency(b.payout) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${won ? "bg-lime/10 text-lime" : "bg-red-500/10 text-red-400"}`} style={won ? { background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}>
                          {b.result}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] text-muted-foreground">{timeAgo(b.createdAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setProvablyFairOpen(true)}
                          className="flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
                          title="Verify this bet"
                        >
                          <Shield className="h-2.5 w-2.5" /> Verify
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="px-2 text-xs font-mono text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="h-8"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
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

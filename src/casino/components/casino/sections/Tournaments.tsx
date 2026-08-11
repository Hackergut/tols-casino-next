"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Users, Clock, DollarSign, Crown, Calendar, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/types";
import { toast } from "sonner";

interface Tournament {
  id: string; name: string; game: string; prizePool: number; entryFee: number;
  startDate: string; endDate: string; status: string; participantsCount: number;
  maxParticipants: number; description: string; currency: string; bannerColor: string;
  leaderboard: { rank: number; username: string; wagered: number; wins: number; biggestWin: number }[];
}

function timeLeft(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function Tournaments() {
  const [tab, setTab] = useState("active");
  const qc = useQueryClient();

  const { data: tournaments } = useQuery<Tournament[]>({
    queryKey: ["tournaments", tab],
    queryFn: async () => {
      const r = await fetch(`/api/tournaments?status=${tab === "all" ? "" : tab}`);
      const j = await r.json();
      return j.data;
    },
  });

  const [selected, setSelected] = useState<string | null>(null);
  const selectedT = tournaments?.find((t) => t.id === selected) || tournaments?.[0];

  const joinMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/tournaments/${id}`, { method: "POST" });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: () => {
      toast.success("Joined tournament!");
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
            <Trophy className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
          </div>
          <div>
            <h1 className=" text-xl font-bold uppercase tracking-wide">Tournaments</h1>
            <p className="text-xs text-muted-foreground">Compete for prize pools. Wager to climb the leaderboard.</p>
          </div>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-background/60">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="ended">Ended</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Tournament cards */}
        <div className="space-y-3">
          {tournaments?.map((t) => {
            const isSelected = selectedT?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`group relative flex w-full overflow-hidden rounded-xl border p-4 text-left transition-all ${
                  isSelected ? "border-lime/50 bg-lime/5" : "border-border/50 bg-card/40 hover:border-border"
                }`}
                style={isSelected ? { borderColor: "color-mix(in oklab, var(--color-lime) 50%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" } : {}}
              >
                {/* color stripe */}
                <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: t.bannerColor }} />

                <div className="ml-2 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className=" text-lg font-bold uppercase tracking-wide">{t.name}</h3>
                        <Badge variant="outline" className="text-[9px] uppercase" style={{ borderColor: t.bannerColor, color: t.bannerColor }}>
                          {t.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prize Pool</div>
                      <div className=" text-xl font-bold" style={{ color: t.bannerColor }}>
                        {formatCurrency(t.prizePool)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      {t.entryFee > 0 ? `${formatCurrency(t.entryFee)} entry` : "Free entry"}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {formatNumber(t.participantsCount)} / {t.maxParticipants > 0 ? formatNumber(t.maxParticipants) : "∞"}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeLeft(t.endDate)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Game: {t.game === "all" ? "All games" : t.game}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {tournaments?.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/30 py-16 text-center">
              <Trophy className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No {tab} tournaments right now.</p>
            </div>
          )}
        </div>

        {/* Leaderboard panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          {selectedT && (
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
              {/* Banner */}
              <div className="relative h-24 overflow-hidden p-4" style={{ background: `linear-gradient(135deg, ${selectedT.bannerColor}22, transparent)` }}>
                <div className="absolute inset-0 bg-grid-lime opacity-20" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className=" text-base font-bold uppercase leading-tight tracking-wide">{selectedT.name}</h3>
                    <p className="text-xs text-muted-foreground">{formatCurrency(selectedT.prizePool)} prize pool</p>
                  </div>
                  <Trophy className="h-8 w-8" style={{ color: selectedT.bannerColor }} />
                </div>
              </div>

              {/* Join button */}
              <div className="border-b border-border/40 p-3">
                <Button
                  onClick={() => joinMutation.mutate(selectedT.id)}
                  disabled={joinMutation.isPending || joinMutation.isSuccess}
                  className="w-full text-sm font-semibold uppercase tracking-wide"
                  style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
                >
                  {joinMutation.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Joining…</>
                  ) : joinMutation.isSuccess ? (
                    <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Joined!</>
                  ) : (
                    <>Join {selectedT.entryFee > 0 ? `· ${formatCurrency(selectedT.entryFee)}` : "Free"}</>
                  )}
                </Button>
              </div>

              {/* Leaderboard */}
              <div className="max-h-96 overflow-y-auto">
                <div className="border-b border-border/40 px-3 py-2">
                  <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">Leaderboard · Top {selectedT.leaderboard.length}</span>
                </div>
                {selectedT.leaderboard.map((e) => (
                  <div
                    key={e.rank}
                    className={`flex items-center gap-2 border-b border-border/30 px-3 py-2 text-sm ${
                      e.rank <= 3 ? "bg-lime/5" : ""
                    }`}
                    style={e.rank <= 3 ? { background: "color-mix(in oklab, var(--color-lime) 3%, transparent)" } : {}}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      e.rank === 1 ? "text-yellow-400" : e.rank === 2 ? "text-gray-300" : e.rank === 3 ? "text-orange-400" : "text-muted-foreground"
                    }`}>
                      {e.rank <= 3 ? <Crown className="h-3.5 w-3.5" /> : e.rank}
                    </span>
                    <span className="flex-1 truncate font-medium">{e.username}</span>
                    <div className="text-right">
                      <div className="font-mono text-xs font-semibold tabular-nums">{formatCurrency(e.wagered)}</div>
                      <div className="text-[9px] text-muted-foreground">{e.wins} wins</div>
                    </div>
                  </div>
                ))}
                {selectedT.leaderboard.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">No entries yet. Be the first!</div>
                )}
              </div>

              {/* Prize distribution */}
              <div className="border-t border-border/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className=" text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prize Distribution</span>
                  <span className="text-[10px] text-muted-foreground">Top 10 split</span>
                </div>
                <PrizeDistribution prizePool={selectedT.prizePool} color={selectedT.bannerColor} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Prize distribution visualization — how the prize pool splits among top 10
function PrizeDistribution({ prizePool, color }: { prizePool: number; color: string }) {
  // Standard payout structure: top 10 receive prizes weighted toward the top
  const weights = [40, 20, 12, 8, 6, 4, 3, 3, 2, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const prizes = weights.map((w, i) => ({
    rank: i + 1,
    pct: (w / totalWeight) * 100,
    amount: (prizePool * w) / totalWeight,
  }));

  return (
    <div className="space-y-1">
      {prizes.map((p) => (
        <div key={p.rank} className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold" style={{
            background: p.rank <= 3 ? color + "20" : "transparent",
            color: p.rank <= 3 ? color : "var(--color-muted-foreground)",
            border: `1px solid ${p.rank <= 3 ? color + "40" : "rgba(255,255,255,0.1)"}`,
          }}>
            {p.rank}
          </span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-background/60">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${Math.max(2, p.pct)}%`,
                background: `linear-gradient(90deg, ${color}, ${color}80)`,
                boxShadow: p.rank <= 3 ? `0 0 8px ${color}40` : "none",
              }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-mono text-[10px] font-bold tabular-nums" style={{ color: p.rank <= 3 ? color : "var(--color-muted-foreground)" }}>
            {formatCurrency(p.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

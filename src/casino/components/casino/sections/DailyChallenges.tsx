"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Check, Gift, Loader2, ChevronRight, Flame, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/types";
import { useSessionStore, useUIStore } from "@/lib/store";
import { toast } from "sonner";

interface Challenge {
  id: string;
  game: string;
  type: string;
  target: number;
  reward: number;
  title: string;
  desc: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  canClaim: boolean;
}

interface ChallengesData {
  date: string;
  challenges: Challenge[];
  weeklyChallenges: Challenge[];
  totalCompleted: number;
  totalClaimed: number;
  totalReward: number;
  weeklyCompleted: number;
  weeklyReward: number;
}

const GAME_ICONS: Record<string, string> = {
  dice: "🎲", crash: "🚀", plinko: "⚪", mines: "💣", limbo: "📈", coinflip: "🪙", wheel: "🎡", all: "🎯",
};

export function DailyChallenges() {
  const qc = useQueryClient();
  const { adjustBalance } = useSessionStore();
  const { setActiveSection, setSelectedGame } = useUIStore();

  const { data } = useQuery<ChallengesData>({
    queryKey: ["challenges"],
    queryFn: async () => {
      const r = await fetch("/api/challenges");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 10000,
  });

  const claimMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const r = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
      });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (data) => {
      adjustBalance(data.reward);
      qc.invalidateQueries({ queryKey: ["challenges"] });
      toast.success(`Challenge reward claimed: +${formatCurrency(data.reward)}!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const challenges = data?.challenges || [];

  const playGame = (game: string) => {
    if (game === "all") {
      setActiveSection("originals");
    } else {
      setSelectedGame(game);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Target className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Daily Challenges</h1>
          <p className="text-xs text-muted-foreground">Complete objectives to earn bonus USDT. Resets daily at 00:00 UTC.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Completed</span>
          </div>
          <div className=" text-lg font-bold">{data?.totalCompleted || 0}/{challenges.length}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Gift className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Claimed</span>
          </div>
          <div className=" text-lg font-bold">{data?.totalClaimed || 0}/{challenges.length}</div>
        </div>
        <div className="rounded-lg border border-lime/20 bg-lime/5 p-3" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">Available</span>
          </div>
          <div className=" text-lg font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(data?.totalReward || 0)}</div>
        </div>
      </div>

      {/* Challenge cards */}
      <div className="grid gap-3 md:grid-cols-3">
        {challenges.map((c) => {
          const pct = Math.min(100, (c.progress / c.target) * 100);
          const icon = GAME_ICONS[c.game] || "🎯";
          return (
            <div
              key={c.id}
              className={`relative overflow-hidden rounded-lg border p-4 transition-all ${
                c.claimed
                  ? "border-border/30 bg-card/20 opacity-60"
                  : c.completed
                  ? "border-lime/40 bg-lime/5"
                  : "border-border/50 bg-card/40"
              }`}
              style={c.completed && !c.claimed ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" } : {}}
            >
              {c.claimed && (
                <div className="absolute right-2 top-2 rounded bg-secondary/60 px-1.5 py-0.5 text-[8px] font-bold uppercase text-muted-foreground">
                  Claimed
                </div>
              )}
              {c.completed && !c.claimed && (
                <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded bg-lime px-1.5 py-0.5 text-[8px] font-bold uppercase text-black" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
                  <Flame className="h-2.5 w-2.5" /> Ready
                </div>
              )}

              <div className="mb-2 flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <div>
                  <h3 className=" text-sm font-bold uppercase tracking-wide">{c.title}</h3>
                  <p className="text-[10px] text-muted-foreground">{c.desc}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono font-bold" style={{ color: c.completed ? "var(--color-lime)" : "var(--color-muted-foreground)" }}>
                    {c.type === "wager" || c.type === "biggest_win" ? `$${c.progress.toFixed(0)}` : c.progress.toFixed(0)}
                    /{c.type === "wager" || c.type === "biggest_win" ? `$${c.target}` : c.target}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }} />
              </div>

              {/* Reward + action */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Gift className="h-3.5 w-3.5" style={{ color: "var(--color-lime)" }} />
                  <span className="font-mono text-sm font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(c.reward)}</span>
                </div>
                {c.canClaim ? (
                  <Button
                    onClick={() => claimMutation.mutate(c.id)}
                    disabled={claimMutation.isPending}
                    size="sm"
                    className="h-7 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
                  >
                    {claimMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
                  </Button>
                ) : c.claimed ? (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Check className="h-3 w-3" /> Done
                  </span>
                ) : (
                  <button
                    onClick={() => playGame(c.game)}
                    className="flex items-center gap-0.5 rounded border border-border/60 px-2 py-1 text-[9px] font-semibold uppercase transition-colors hover:border-lime/40 hover:text-lime"
                  >
                    Play <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly challenges */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">📅</span>
          <h3 className=" text-sm font-semibold uppercase tracking-wide">Weekly Challenges</h3>
          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-400">
            {data?.weeklyCompleted || 0}/{(data?.weeklyChallenges || []).length} done
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            Available: <span className="font-mono font-bold" style={{ color: "var(--color-vip)" }}>{formatCurrency(data?.weeklyReward || 0)}</span>
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.weeklyChallenges || []).map((c) => {
            const pct = Math.min(100, (c.progress / c.target) * 100);
            const icon = GAME_ICONS[c.game] || "🎯";
            return (
              <div
                key={c.id}
                className={`relative overflow-hidden rounded-lg border p-4 transition-all ${
                  c.claimed
                    ? "border-border/30 bg-card/20 opacity-60"
                    : c.completed
                    ? "border-purple-500/40 bg-purple-500/5"
                    : "border-border/50 bg-card/40"
                }`}
                style={c.completed && !c.claimed ? { borderColor: "color-mix(in oklab, var(--color-vip) 40%, transparent)", background: "color-mix(in oklab, var(--color-vip) 5%, transparent)" } : {}}
              >
                {c.claimed && (
                  <div className="absolute right-2 top-2 rounded bg-secondary/60 px-1.5 py-0.5 text-[8px] font-bold uppercase text-muted-foreground">
                    Claimed
                  </div>
                )}
                {c.completed && !c.claimed && (
                  <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded bg-purple-500 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white">
                    <Flame className="h-2.5 w-2.5" /> Ready
                  </div>
                )}

                <div className="mb-2 flex items-center gap-2">
                  <span className="text-2xl">{icon}</span>
                  <div>
                    <h3 className=" text-sm font-bold uppercase tracking-wide">{c.title}</h3>
                    <p className="text-[10px] text-muted-foreground">{c.desc}</p>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="mb-1 flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-mono font-bold" style={{ color: c.completed ? "var(--color-vip)" : "var(--color-muted-foreground)" }}>
                      {c.type === "wager" || c.type === "biggest_win" ? `$${c.progress.toFixed(0)}` : c.progress.toFixed(0)}
                      /{c.type === "wager" || c.type === "biggest_win" ? `$${c.target}` : c.target}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" style={{ background: "color-mix(in oklab, var(--color-vip) 10%, transparent)" }} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" style={{ color: "var(--color-vip)" }} />
                    <span className="font-mono text-sm font-bold" style={{ color: "var(--color-vip)" }}>{formatCurrency(c.reward)}</span>
                  </div>
                  {c.canClaim ? (
                    <Button
                      onClick={() => claimMutation.mutate(c.id)}
                      disabled={claimMutation.isPending}
                      size="sm"
                      className="h-7 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: "var(--color-vip)", color: "#fff" }}
                    >
                      {claimMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Claim"}
                    </Button>
                  ) : c.claimed ? (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
                      <Check className="h-3 w-3" /> Done
                    </span>
                  ) : (
                    <button
                      onClick={() => playGame(c.game)}
                      className="flex items-center gap-0.5 rounded border border-border/60 px-2 py-1 text-[9px] font-semibold uppercase transition-colors hover:border-purple-500/40 hover:text-purple-400"
                    >
                      Play <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-border/40 bg-card/20 p-3 text-center text-[10px] text-muted-foreground">
        Daily challenges reset at 00:00 UTC · Weekly challenges reset on Sunday — claim your rewards before they expire!
      </div>
    </div>
  );
}

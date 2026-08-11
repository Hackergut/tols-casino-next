"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Flame, Gift, Check, Loader2, ChevronRight } from "lucide-react";
import { useSessionStore } from "@/lib/store";
import { formatCurrency } from "@/lib/types";
import { toast } from "sonner";

interface StreakData {
  streak: number;
  lastClaim: string | null;
  totalClaimed: number;
  claimedToday: boolean;
  nextReward: number;
  nextDay: number;
  canClaim: boolean;
}

const DAY_REWARDS = [5, 10, 15, 20, 25, 30, 50];

export function DailyStreakWidget() {
  const qc = useQueryClient();
  const { adjustBalance } = useSessionStore();
  const [expanded, setExpanded] = useState(false);

  const { data: streak } = useQuery<StreakData>({
    queryKey: ["daily-streak"],
    queryFn: async () => {
      const r = await fetch("/api/daily-streak");
      const j = await r.json();
      return j.data;
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/daily-streak", { method: "POST" });
      const j = await r.json();
      if (!j.success) throw new Error(j.error);
      return j.data;
    },
    onSuccess: (data) => {
      adjustBalance(data.reward);
      qc.invalidateQueries({ queryKey: ["daily-streak"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      toast.success(`Daily bonus claimed: +${formatCurrency(data.reward)}! Day ${data.streak} streak 🔥`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!streak) return null;

  const currentDay = streak.claimedToday ? streak.streak : streak.streak + 1;

  return (
    <div className="rounded-lg border border-lime/20 bg-gradient-to-br from-lime/5 to-transparent p-3" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-1.5">
          <Flame className="h-4 w-4" style={{ color: streak.streak > 0 ? "var(--color-pending)" : "#6b7280" }} />
          <span className=" text-sm font-semibold uppercase tracking-wide">Daily Bonus</span>
          {streak.streak > 0 && (
            <span className="rounded bg-orange-500/20 px-1 text-[9px] font-bold text-orange-400">
              {streak.streak}🔥
            </span>
          )}
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* 7-day calendar */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_REWARDS.map((reward, i) => {
              const day = i + 1;
              const isClaimed = day <= streak.streak;
              const isToday = day === currentDay && !streak.claimedToday;
              const isPast = day < currentDay;
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center rounded-md border p-1 text-center transition-all ${
                    isClaimed ? "border-lime/40 bg-lime/10" : isToday ? "border-orange-500/50 bg-orange-500/10 animate-pulse" : "border-border/40"
                  }`}
                  style={isClaimed ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" } : {}}
                >
                  <span className={`text-[8px] font-bold uppercase ${isClaimed ? "text-lime" : "text-muted-foreground"}`} style={isClaimed ? { color: "var(--color-lime)" } : {}}>
                    D{day}
                  </span>
                  {isClaimed ? (
                    <Check className="h-3 w-3" style={{ color: "var(--color-lime)" }} />
                  ) : (
                    <span className="text-[8px] font-mono text-muted-foreground">${reward}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Claim button */}
          <button
            onClick={() => claimMutation.mutate()}
            disabled={streak.claimedToday || claimMutation.isPending}
            className={`w-full rounded-md py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
              streak.claimedToday
                ? "border border-border/40 bg-secondary/20 text-muted-foreground"
                : "shadow-[0_0_16px_color-mix(in oklab, var(--color-lime) 30%, transparent)] hover:shadow-[0_0_24px_color-mix(in oklab, var(--color-lime) 50%, transparent)]"
            }`}
            style={!streak.claimedToday ? { background: "var(--color-lime)", color: "var(--color-bg)" } : {}}
          >
            {claimMutation.isPending ? (
              <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
            ) : streak.claimedToday ? (
              <><Check className="mr-1 inline h-3.5 w-3.5" /> Claimed Today</>
            ) : (
              <><Gift className="mr-1 inline h-3.5 w-3.5" /> Claim ${streak.nextReward}</>
            )}
          </button>

          <p className="text-center text-[9px] text-muted-foreground">
            Total claimed: {formatCurrency(streak.totalClaimed)} · Come back daily to keep your streak!
          </p>
        </div>
      )}
    </div>
  );
}

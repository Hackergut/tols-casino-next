"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, TrendingUp, Gift, Percent, Star, Shield, Zap, Check, Lock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUIStore, useSessionStore } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/types";

interface SessionData {
  wallet: { balance: number; vipLevel: number; xp: number; totalWagered: number } | null;
}

const TIERS = [
  {
    level: 1,
    name: "Bronze",
    color: "#cd7f32",
    minWagered: 0,
    rakeback: 3,
    perks: ["Daily bonus claim", "Basic chat access", "Standard withdrawal speed"],
  },
  {
    level: 2,
    name: "Silver",
    color: "#c0c0c0",
    minWagered: 1000,
    rakeback: 5,
    perks: ["Daily bonus +5%", "Priority chat support", "Faster withdrawals (2h)"],
  },
  {
    level: 3,
    name: "Gold",
    color: "#ffd700",
    minWagered: 10000,
    rakeback: 8,
    perks: ["Daily bonus +10%", "Weekly reload bonus", "1h withdrawals", "Exclusive Gold tournaments"],
  },
  {
    level: 4,
    name: "Platinum",
    color: "#e5e4e2",
    minWagered: 50000,
    rakeback: 12,
    perks: ["Daily bonus +15%", "Weekly reload +25%", "Instant withdrawals", "Personal VIP host", "Birthday bonus"],
  },
  {
    level: 5,
    name: "Diamond",
    color: "#b9f2ff",
    minWagered: 250000,
    rakeback: 15,
    perks: ["Daily bonus +25%", "Weekly reload +50%", "Instant withdrawals", "Dedicated VIP host", "Monthly cashback 5%", "Exclusive high-roller tables"],
  },
  {
    level: 6,
    name: "TOLS Legend",
    color: "var(--color-lime)",
    minWagered: 1000000,
    rakeback: 20,
    perks: ["Daily bonus +50%", "Unlimited reload bonuses", "Instant + feeless withdrawals", "24/7 dedicated host", "Monthly cashback 10%", "Private TOLS Legend lounge", "Custom avatar frame", "VIP event invitations"],
  },
];

export function VIPTiers() {
  const { setActiveSection } = useUIStore();
  const { balance } = useSessionStore();

  const { data: session } = useQuery<SessionData>({
    queryKey: ["session"],
    queryFn: async () => {
      const r = await fetch("/api/session");
      const j = await r.json();
      return j.data;
    },
  });

  const currentLevel = session?.wallet?.vipLevel ?? 1;
  const totalWagered = session?.wallet?.totalWagered ?? 0;
  const xp = session?.wallet?.xp ?? 0;

  const currentTier = TIERS.find((t) => t.level === currentLevel) || TIERS[0];
  const nextTier = TIERS.find((t) => t.level === currentLevel + 1);
  const progressPct = nextTier
    ? Math.min(100, ((totalWagered - currentTier.minWagered) / (nextTier.minWagered - currentTier.minWagered)) * 100)
    : 100;
  const toNext = nextTier ? nextTier.minWagered - totalWagered : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Crown className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">VIP Club</h1>
          <p className="text-xs text-muted-foreground">Climb tiers for rakeback, bonuses & dedicated hosts.</p>
        </div>
      </div>

      {/* Current status card */}
      <div className="relative overflow-hidden rounded-xl border p-5" style={{ borderColor: currentTier.color + "60", background: `linear-gradient(135deg, ${currentTier.color}15, transparent)` }}>
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-30" style={{ background: currentTier.color }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Crown className="h-5 w-5" style={{ color: currentTier.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current Tier</span>
            </div>
            <h2 className=" text-3xl font-bold uppercase" style={{ color: currentTier.color }}>
              {currentTier.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Level {currentLevel} · {currentTier.rakeback}% rakeback · {formatCurrency(totalWagered)} wagered
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 animate-glow-pulse" style={{ borderColor: currentTier.color, boxShadow: `0 0 20px ${currentTier.color}40` }}>
              <span className=" text-2xl font-bold" style={{ color: currentTier.color }}>{currentLevel}</span>
            </div>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextTier ? (
          <div className="relative mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress to <span className="font-semibold" style={{ color: nextTier.color }}>{nextTier.name}</span></span>
              <span className="font-mono text-muted-foreground">{progressPct.toFixed(1)}%</span>
            </div>
            <Progress value={progressPct} className="h-2.5" style={{ background: "rgba(255,255,255,0.05)" }} />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Wager <span className="font-mono font-bold" style={{ color: "var(--color-lime)" }}>{formatCurrency(toNext)}</span> more to reach {nextTier.name}
            </p>
          </div>
        ) : (
          <div className="relative mt-4 rounded-md border border-lime/30 bg-lime/5 p-2 text-center" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-lime)" }}>★ Max tier reached — you are a TOLS Legend ★</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Current Rakeback" value={`${currentTier.rakeback}%`} icon={Percent} color={currentTier.color} />
        <StatCard label="Total Wagered" value={formatCurrency(totalWagered)} icon={TrendingUp} />
        <StatCard label="XP" value={formatNumber(xp)} icon={Zap} color="#3b82f6" />
        <StatCard label="Balance" value={formatCurrency(balance)} icon={Gift} color="var(--color-lime)" />
      </div>

      {/* All tiers */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">All VIP Tiers</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((tier) => {
            const isCurrent = tier.level === currentLevel;
            const isUnlocked = tier.level <= currentLevel;
            return (
              <div
                key={tier.level}
                className={`relative overflow-hidden rounded-lg border p-4 transition-all ${
                  isCurrent ? "ring-1" : ""
                }`}
                style={{
                  borderColor: isUnlocked ? tier.color + "50" : "rgba(255,255,255,0.08)",
                  background: isUnlocked ? `linear-gradient(135deg, ${tier.color}10, transparent)` : "rgba(255,255,255,0.02)",
                  boxShadow: isCurrent ? `0 0 16px ${tier.color}30` : "none",
                }}
              >
                {isCurrent && (
                  <div className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ background: tier.color, color: "var(--color-bg)" }}>
                    Current
                  </div>
                )}
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: tier.color }}>
                    {isUnlocked ? (
                      <Crown className="h-4 w-4" style={{ color: tier.color }} />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className=" text-base font-bold uppercase" style={{ color: isUnlocked ? tier.color : "var(--color-muted-foreground)" }}>
                      {tier.name}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Tier {tier.level}</div>
                  </div>
                </div>

                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Rakeback</span>
                  <span className="font-mono font-bold" style={{ color: isUnlocked ? tier.color : "var(--color-muted-foreground)" }}>{tier.rakeback}%</span>
                </div>
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Required</span>
                  <span className="font-mono text-muted-foreground">{formatCurrency(tier.minWagered)}</span>
                </div>

                <div className="space-y-1">
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px]">
                      <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: isUnlocked ? tier.color : "#6b7280" }} />
                      <span className={isUnlocked ? "text-foreground/80" : "text-muted-foreground"}>{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 p-4">
        <div>
          <h4 className=" text-sm font-semibold uppercase">Ready to climb?</h4>
          <p className="text-xs text-muted-foreground">Play games to earn XP and wager toward the next tier.</p>
        </div>
        <Button onClick={() => setActiveSection("originals")} className=" uppercase" style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}>
          Play Now <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
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

"use client";

import { useState } from "react";
import { Gift, Percent, Clock, TrendingUp, Sparkles, Check, ChevronRight, Flame, Coins, Zap, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUIStore, useSessionStore } from "@/lib/store";
import { formatCurrency } from "@/lib/types";
import { toast } from "sonner";

interface Promo {
  id: string;
  title: string;
  description: string;
  type: "welcome" | "rakeback" | "reload" | "cashback" | "tournament" | "referral";
  reward: string;
  rewardAmount: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  active: boolean;
  claimed?: boolean;
  expiresIn?: string;
  requirements?: string[];
}

const PROMOS: Promo[] = [
  {
    id: "welcome",
    title: "Welcome Bonus",
    description: "Get 100% match on your first deposit up to $1,000. Automatically credited to your wallet.",
    type: "welcome",
    reward: "100% up to $1,000",
    rewardAmount: 1000,
    icon: Gift,
    color: "var(--color-lime)",
    active: true,
    requirements: ["First deposit only", "30× wagering requirement", "Valid for 7 days"],
  },
  {
    id: "rakeback",
    title: "Daily Rakeback",
    description: "Get up to 20% of your daily losses back, every day. No opt-in needed — automatic credit.",
    type: "rakeback",
    reward: "Up to 20% back",
    rewardAmount: 20,
    icon: Percent,
    color: "var(--color-vip)",
    active: true,
    expiresIn: "Resets at 00:00 UTC",
    requirements: ["Based on VIP tier", "Credited daily", "No wagering requirement"],
  },
  {
    id: "reload",
    title: "Weekly Reload",
    description: "Every Friday, get a 50% reload bonus up to $500 on your deposit. Weekend ready!",
    type: "reload",
    reward: "50% up to $500",
    rewardAmount: 500,
    icon: Zap,
    color: "#3b82f6",
    active: true,
    expiresIn: "Every Friday 00:00–23:59 UTC",
    requirements: ["Min deposit $20", "1× wagering", "Friday only"],
  },
  {
    id: "cashback",
    title: "Monthly Cashback",
    description: "Diamond+ members get 10% monthly cashback on net losses. Credited on the 1st.",
    type: "cashback",
    reward: "10% monthly",
    rewardAmount: 10,
    icon: TrendingUp,
    color: "#10b981",
    active: true,
    expiresIn: "Next: 1st of month",
    requirements: ["Diamond+ tier", "Min $100 net loss", "No wagering"],
  },
  {
    id: "megadrop",
    title: "Mega Drop Jackpot",
    description: "Every bet feeds the progressive Mega Drop. Could drop at any moment — are you the lucky one?",
    type: "tournament",
    reward: "Progressive pot",
    rewardAmount: 184521,
    icon: Flame,
    color: "var(--color-loss)",
    active: true,
    requirements: ["Any bet qualifies", "Random trigger", "No max bet cap"],
  },
  {
    id: "referral",
    title: "Referral Commission",
    description: "Invite friends and earn 25-30% revshare on their wagers, for life. Stack passive income.",
    type: "referral",
    reward: "25-30% revshare",
    rewardAmount: 30,
    icon: Coins,
    color: "var(--color-pending)",
    active: true,
    requirements: ["No limit on referrals", "Lifetime commission", "Revshare or CPA plan"],
  },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "welcome", label: "Welcome" },
  { id: "rakeback", label: "Rakeback" },
  { id: "reload", label: "Reload" },
  { id: "cashback", label: "Cashback" },
  { id: "tournament", label: "Jackpot" },
  { id: "referral", label: "Referral" },
];

export function Promotions() {
  const { setActiveSection } = useUIStore();
  const { balance, adjustBalance } = useSessionStore();
  const [filter, setFilter] = useState("all");
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});

  const filtered = filter === "all" ? PROMOS : PROMOS.filter((p) => p.type === filter);

  const claim = (promo: Promo) => {
    if (claimed[promo.id]) return;
    if (promo.type === "welcome") {
      adjustBalance(promo.rewardAmount);
      toast.success(`Welcome bonus claimed: +${formatCurrency(promo.rewardAmount)}`);
    } else if (promo.type === "reload") {
      adjustBalance(50);
      toast.success(`Reload bonus: +${formatCurrency(50)}`);
    } else if (promo.type === "rakeback") {
      const back = Math.floor(Math.random() * 30) + 10;
      adjustBalance(back);
      toast.success(`Daily rakeback: +${formatCurrency(back)}`);
    } else {
      toast.info(`${promo.title}: ${promo.description.slice(0, 50)}...`);
    }
    setClaimed((c) => ({ ...c, [promo.id]: true }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 20%, transparent)", background: "color-mix(in oklab, var(--color-lime) 5%, transparent)" }}>
          <Gift className="h-4 w-4" style={{ color: "var(--color-lime)" }} />
        </div>
        <div>
          <h1 className=" text-xl font-bold uppercase tracking-wide">Promotions</h1>
          <p className="text-xs text-muted-foreground">Bonuses, rakeback, reloads & exclusive offers.</p>
        </div>
      </div>

      {/* Featured welcome banner */}
      <div className="relative overflow-hidden rounded-xl border animate-gradient p-5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "linear-gradient(135deg, color-mix(in oklab, var(--color-lime) 8%, transparent), color-mix(in oklab, var(--color-vip) 8%, transparent), color-mix(in oklab, var(--color-lime) 8%, transparent))" }}>
        <div className="absolute inset-0 bg-grid-lime opacity-20" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime/20 blur-3xl animate-pulse-scale" style={{ background: "color-mix(in oklab, var(--color-lime) 20%, transparent)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/10 px-2.5 py-0.5" style={{ borderColor: "color-mix(in oklab, var(--color-lime) 30%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)" }}>
              <Sparkles className="h-3 w-3" style={{ color: "var(--color-lime)" }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-lime)" }}>Limited Time</span>
            </div>
            <h2 className=" text-2xl font-bold uppercase sm:text-3xl">
              <span style={{ color: "var(--color-lime)" }}>100%</span> Welcome Bonus
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Match your first deposit up to $1,000. Play more, win more.</p>
          </div>
          <Button
            onClick={() => claim(PROMOS[0])}
            disabled={claimed["welcome"]}
            className=" text-sm font-semibold uppercase tracking-wide shadow-[0_0_24px_color-mix(in oklab, var(--color-lime) 40%, transparent)]"
            style={{ background: "var(--color-lime)", color: "var(--color-bg)" }}
          >
            {claimed["welcome"] ? <><Check className="mr-1.5 h-4 w-4" /> Claimed</> : <>Claim Bonus <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.id ? "border-lime/40 bg-lime/10 text-lime" : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
            style={filter === f.id ? { borderColor: "color-mix(in oklab, var(--color-lime) 40%, transparent)", background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" } : {}}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Promo cards grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((promo) => {
          const Icon = promo.icon;
          const isClaimed = claimed[promo.id];
          return (
            <div
              key={promo.id}
              className="group relative overflow-hidden rounded-lg border p-4 transition-all hover:scale-[1.01]"
              style={{ borderColor: promo.color + "40", background: `linear-gradient(135deg, ${promo.color}0a, transparent)` }}
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20" style={{ background: promo.color }} />
              <div className="relative flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border" style={{ borderColor: promo.color + "40", background: promo.color + "15" }}>
                  <Icon className="h-5 w-5" style={{ color: promo.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className=" text-base font-bold uppercase">{promo.title}</h3>
                    {promo.active && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-lime" style={{ color: "var(--color-lime)" }}>
                        <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--color-lime)" }} /> Active
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{promo.description}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold" style={{ background: promo.color + "20", color: promo.color }}>
                      {promo.reward}
                    </span>
                    {promo.expiresIn && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" /> {promo.expiresIn}
                      </span>
                    )}
                  </div>

                  {promo.requirements && (
                    <div className="mt-2 space-y-0.5">
                      {promo.requirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-1 w-1 rounded-full bg-muted-foreground" /> {req}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3">
                    <Button
                      onClick={() => claim(promo)}
                      disabled={isClaimed || promo.type === "tournament" || promo.type === "cashback" || promo.type === "referral"}
                      size="sm"
                      className="h-7 text-[10px] font-semibold uppercase tracking-wide"
                      style={isClaimed
                        ? { background: "rgba(255,255,255,0.1)", color: "var(--color-muted-foreground)" }
                        : (promo.type === "tournament" || promo.type === "cashback" || promo.type === "referral")
                        ? { background: "transparent", color: "var(--color-muted-foreground)", border: "1px solid rgba(255,255,255,0.1)" }
                        : { background: promo.color, color: "var(--color-bg)" }
                      }
                    >
                      {isClaimed ? (
                        <><Check className="mr-1 h-3 w-3" /> Claimed</>
                      ) : promo.type === "tournament" ? (
                        <>Auto-triggered</>
                      ) : promo.type === "cashback" ? (
                        <>Auto-credited</>
                      ) : promo.type === "referral" ? (
                        <>View Affiliate</>
                      ) : (
                        <>Claim Now <ChevronRight className="h-3 w-3" /></>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terms note */}
      <div className="rounded-lg border border-border/40 bg-card/20 p-3 text-center text-[10px] text-muted-foreground">
        All bonuses are play-money credits for demo purposes. Bonus wagering requirements apply.
        TOLS reserves the right to modify or cancel promotions at any time.
      </div>
    </div>
  );
}

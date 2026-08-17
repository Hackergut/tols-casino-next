"use client";

import { useQuery } from "@tanstack/react-query";
import { TARGET_RTP } from '@/lib/game-math';
import { Trophy, Flame, Sparkles, TrendingUp, Users, Zap, ChevronRight, Dices, Rocket, CircleDot, Bomb, TrendingUp as Limbo, Coins, Disc, Grid3x3, Play, Cherry, Store } from "lucide-react";
import { GameCard } from "../GameCard";
import { JackpotTicker, OdometerText } from "../JackpotTicker";
import { LiveBetsFeed } from "../LiveBetsFeed";
import { formatCurrency, formatNumber } from "@/lib/types";

interface Game {
  id: string; slug: string; name: string; provider: string; category: string; image: string; rtp: number; featured: boolean; popularity: number; description: string;
}

interface Stats {
  totalBets: number;
  totalWagered: number;
  houseProfit: number;
  jackpot: number;
  onlinePlayers: number;
  totalPlayers: number;
}

const ORIGINALS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dice: Dices, crash: Rocket, plinko: CircleDot, mines: Bomb, limbo: Limbo, coinflip: Coins, wheel: Disc, keno: Grid3x3,
};

export function Lobby({ onSelectGame, onNavigate }: { onSelectGame: (slug: string) => void; onNavigate: (id: string) => void }) {
  const { data: games } = useQuery<Game[]>({
    queryKey: ["games", "all"],
    queryFn: async () => {
      const r = await fetch("/api/games");
      const j = await r.json();
      return j.data;
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 10000,
  });

  const { data: jackpotData } = useQuery({
    queryKey: ["jackpot"],
    queryFn: async () => {
      const r = await fetch("/api/jackpot");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 8000,
  });

  const jackpot = jackpotData?.amount ?? 184521.73;

  const featured = games?.filter((g) => g.featured).slice(0, 10) || [];
  const originals = games?.filter((g) => g.category === "originals") || [];
  const slots = games?.filter((g) => g.category === "slots").slice(0, 12) || [];
  const live = games?.filter((g) => g.category === "live").slice(0, 6) || [];

  return (
    <div className="space-y-6">
      {/* HERO BANNER — Mega Drop Jackpot */}
      <section className="relative overflow-hidden rounded-xl border border-lime/20 bg-gradient-to-br from-lime/5 via-surface to-vip/5">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-vip/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-lime/30 bg-lime/5 px-3 py-1">
              <Trophy className="h-3 w-3 text-lime" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-lime">TOLS Mega Drop</span>
              <span className="pulse-glow ml-1 flex h-1.5 w-1.5 rounded-full bg-lime" />
            </div>
            <h1 className="text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl lg:text-6xl">
              <OdometerText text={formatCurrency(jackpot)} className="text-lime drop-shadow-[0_0_28px_color-mix(in oklab, var(--color-lime) 25%, transparent)]" />
            </h1>
            <p className="mt-2 text-lg font-semibold text-foreground">Could drop at any moment.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Every bet feeds the progressive jackpot. One lucky spin could win it all.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => onSelectGame("crash")}
                className="btn-press flex items-center gap-1.5 rounded-md bg-lime px-4 py-2 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_0_24px] shadow-lime/30 transition-all hover:scale-[1.02] hover:shadow-[0_0_36px] hover:shadow-lime/45"
              >
                <Play className="h-4 w-4 fill-current" /> Play. Hit. Win.
              </button>
              <button
                onClick={() => onNavigate("originals")}
                className="btn-press flex items-center gap-1.5 rounded-md border border-lime/40 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-lime transition-colors hover:bg-lime/10"
              >
                Browse Originals <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 3D-ish chip decoration */}
          <div className="relative hidden h-48 w-48 shrink-0 items-center justify-center lg:flex">
            <div className="animate-spin-slow absolute inset-0 rounded-full border-2 border-dashed border-lime/30" />
            <div className="pulse-glow absolute inset-6 rounded-full border border-lime/20" />
            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-lime/10 shadow-[0_0_40px] shadow-lime/20">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-lime">
                <span className="text-2xl font-bold text-lime">TOLS</span>
              </div>
            </div>
          </div>
        </div>

        {/* stat strip */}
        <div className="relative grid grid-cols-2 divide-x divide-border/40 border-t border-border/40 sm:grid-cols-4">
          {[
            { label: "Online Now", value: stats ? formatNumber(stats.onlinePlayers) : "1,247", icon: Users },
            { label: "Total Bets", value: stats ? formatNumber(stats.totalBets) : "—", icon: Zap },
            { label: "Wagered 24h", value: stats ? formatCurrency(stats.totalWagered) : "—", icon: TrendingUp },
            { label: "Mega Drop", value: <JackpotTicker amount={jackpot} compact />, icon: Trophy },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                  <div className="truncate text-sm font-bold">{s.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TOLS Originals row */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-lime" />
            <h2 className="text-lg font-bold uppercase tracking-wide">TOLS Originals</h2>
            <span className="rounded bg-lime/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-lime">{(TARGET_RTP * 100).toFixed(0)}% RTP</span>
          </div>
          <button onClick={() => onNavigate("originals")} className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-lime">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {originals.map((g) => {
            const Icon = ORIGINALS_ICONS[g.slug] || Dices;
            return (
              <button
                key={g.slug}
                onClick={() => onSelectGame(g.slug)}
                className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-border/50 bg-card/40 card-hover-lift hover:border-lime/40 hover:shadow-[0_0_20px] hover:shadow-lime/15"
              >
                <Icon className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-lime" />
                <span className="text-xs font-semibold uppercase tracking-wide">{g.name}</span>
                <span className="absolute right-1 top-1 rounded bg-black/60 px-1 font-mono text-[8px] text-lime">{g.rtp}%</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Layout: featured games + live bets feed */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Featured */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-vip" />
              <h2 className="text-lg font-bold uppercase tracking-wide">Featured Games</h2>
            </div>
            <button onClick={() => onNavigate("slots")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-lime">
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {featured.map((g) => (
              <GameCard
                key={g.id}
                slug={g.slug}
                name={g.name}
                provider={g.provider}
                category={g.category}
                image={g.image}
                rtp={g.rtp}
                featured={g.featured}
                popularity={g.popularity}
                onClick={() => {
                  if (g.category === "originals") onSelectGame(g.slug);
                  else if (g.category === "live") onNavigate("live");
                  else onNavigate("slots");
                }}
              />
            ))}
          </div>
        </section>

        {/* Live bets feed */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <LiveBetsFeed />
        </aside>
      </div>

      {/* Slots */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cherry className="h-5 w-5 text-lime" />
            <h2 className="text-lg font-bold uppercase tracking-wide">Popular Slots</h2>
          </div>
          <button onClick={() => onNavigate("slots")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-lime">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {slots.map((g) => (
            <GameCard
              key={g.id}
              slug={g.slug}
              name={g.name}
              provider={g.provider}
              category={g.category}
              image={g.image}
              rtp={g.rtp}
              popularity={g.popularity}
              onClick={() => onNavigate("slots")}
            />
          ))}
        </div>
      </section>

      {/* Live casino */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-loss opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-loss" />
            </span>
            <h2 className="text-lg font-bold uppercase tracking-wide">Live Casino</h2>
          </div>
          <button onClick={() => onNavigate("live")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-lime">
            View all <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {live.map((g) => (
            <GameCard
              key={g.id}
              slug={g.slug}
              name={g.name}
              provider={g.provider}
              category={g.category}
              image={g.image}
              rtp={g.rtp}
              popularity={g.popularity}
              onClick={() => onNavigate("live")}
            />
          ))}
        </div>
      </section>

      {/* Game Providers */}
      <ProvidersShowcase onNavigate={onNavigate} />
    </div>
  );
}

// Provider logos showcase
function ProvidersShowcase({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { data } = useQuery<{ providers: Array<{ name: string; slug: string; logo: string; gameCount: number; categories: string[] }>; total: number }>({
    queryKey: ["providers"],
    queryFn: async () => {
      const r = await fetch("/api/providers");
      const j = await r.json();
      return j.data;
    },
  });

  const providers = data?.providers || [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold uppercase tracking-wide">Game Providers</h2>
          <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{providers.length}</span>
        </div>
        <button onClick={() => onNavigate("slots")} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-lime">
          View all games <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {providers.map((p) => (
          <button
            key={p.slug}
            onClick={() => onNavigate("slots")}
            className="group relative flex shrink-0 flex-col items-center gap-2 overflow-hidden rounded-lg border border-border/50 bg-card/40 p-3 transition-all card-hover-lift hover:border-lime/40 hover:bg-lime/5"
            style={{ minWidth: 140 }}
          >
            <div className="flex h-12 w-32 items-center justify-center rounded-md bg-background/60 p-1">
              <img
                src={p.logo}
                alt={p.name}
                className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="text-center">
              <div className="truncate text-[10px] font-semibold uppercase tracking-wide">{p.name}</div>
              <div className="text-[9px] text-muted-foreground">{p.gameCount} games</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

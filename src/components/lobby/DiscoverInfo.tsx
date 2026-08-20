"use client";

/*
 * Discover info pages — the informational landing for each Discover section.
 *
 * Discover groups the discovery surface of the platform (Promotions,
 * Challenges, Leaderboards, Affiliate, …). These are the dedicated info pages
 * for the sections that are purely informational; functional sections (Wallet,
 * Transactions, Settings, Live Support) live in ProfileSections.tsx.
 */

import { ArrowLeft, Gift, Swords, CheckCircle2, ArrowUpRight } from "lucide-react";
import { ALL_PROMOTIONS, type TolsPromotion } from "./promotions";

function InfoShell({ title, subtitle, icon: Icon, onBack, children }: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.7)" }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "color-mix(in oklab, var(--color-lime) 12%, transparent)", border: "1px solid color-mix(in oklab, var(--color-lime) 20%, transparent)" }}>
            <Icon className="h-5 w-5 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{subtitle}</p>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function PromoDetailCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = promo.icon;
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-surface/60">
      {/* 16:9 artwork header, matching the promo card. */}
      <div className="relative aspect-[16/9] overflow-hidden">
        <img src={promo.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
          <div>
            <h3 className="text-base font-bold text-white" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}>{promo.title}</h3>
            {promo.badge && <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: promo.accent }}>{promo.badge}</p>}
          </div>
          <span className="rounded-lg bg-black/60 px-2.5 py-1 font-mono text-sm font-black tabular-nums backdrop-blur-md" style={{ color: promo.accent }}>
            {promo.reward}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border" style={{ background: `color-mix(in oklab, ${promo.accent} 14%, transparent)`, borderColor: `color-mix(in oklab, ${promo.accent} 30%, transparent)` }}>
            <Icon className="h-4 w-4" style={{ color: promo.accent }} />
          </span>
          <p className="text-sm leading-relaxed text-white/55">{promo.description}</p>
        </div>

        <ul className="mt-3 space-y-1.5">
          {promo.requirements.map((req) => (
            <li key={req} className="flex items-center gap-2 text-xs text-white/50">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: promo.accent }} />
              {req}
            </li>
          ))}
        </ul>

        <button
          onClick={() => onNavigate(promo.target)}
          className="mt-4 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
          style={{ background: promo.accent, color: "var(--color-bg)" }}
        >
          {promo.cta} <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PromotionsInfoSection({ onBack, onNavigate }: { onBack: () => void; onNavigate: (target: string) => void }) {
  return (
    <InfoShell title="Promotions" subtitle="Every official TOLS promotion, in one place" icon={Gift} onBack={onBack}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_PROMOTIONS.map((promo) => (
          <PromoDetailCard key={promo.id} promo={promo} onNavigate={onNavigate} />
        ))}
      </div>
    </InfoShell>
  );
}

const CHALLENGES = [
  { title: "Daily Streak", desc: "Bet every day to keep your streak alive and earn escalating rewards.", reward: "Up to $50 / day" },
  { title: "Originals Gauntlet", desc: "Hit the selected multipliers across Dice, Crash, Mines and more.", reward: "$50,000 pool" },
  { title: "Multiplier Hunter", desc: "Land a multiplier above 100× on any Original before the week ends.", reward: "Bonus credits" },
  { title: "Wagering Race", desc: "Climb the wagered-amount leaderboard for your tier.", reward: "$100,000 pool" },
  { title: "Referral Sprint", desc: "Bring the most new players this month for a bonus commission boost.", reward: "Boosted revshare" },
  { title: "VIP Climb", desc: "Reach the next VIP tier within the window for a tier-up bonus.", reward: "Tier-up bonus" },
];

export function ChallengesInfoSection({ onBack, onNavigate }: { onBack: () => void; onNavigate: (target: string) => void }) {
  return (
    <InfoShell title="Challenges" subtitle="Daily and weekly missions with real rewards" icon={Swords} onBack={onBack}>
      <p className="max-w-2xl text-sm leading-relaxed text-white/55">
        Challenges are auto-tracked missions that run alongside your play. Complete them and the reward is credited
        automatically — no opt-in, no claim timer. Paid bets only; practice rounds never count toward a challenge.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CHALLENGES.map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/8 bg-surface/60 p-5">
            <h3 className="text-sm font-bold text-white">{c.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50">{c.desc}</p>
            <p className="mt-3 font-mono text-sm font-black text-lime">{c.reward}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => onNavigate("originals")}
        className="flex items-center gap-2 rounded-xl bg-lime px-5 py-3 text-sm font-black uppercase tracking-wide text-bg transition-opacity hover:opacity-90"
      >
        Start a challenge <ArrowUpRight className="h-4 w-4" />
      </button>
    </InfoShell>
  );
}

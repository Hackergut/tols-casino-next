"use client";

/*
 * Promotional cards — the official TOLS promotions, shown on the main screen
 * (visible pre sign-up / login, since the lobby renders behind the auth gate).
 *
 * A responsive grid of TOLS-styled cards: glass surface, per-promo accent,
 * icon, reward badge, tagline and the key requirements. Clicking a card routes
 * to its target (claim → register, tiers → VIP, play → Originals, …).
 */

import { ArrowUpRight } from "lucide-react";
import { OFFICIAL_PROMOTIONS, type TolsPromotion } from "./promotions";

function PromoCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = promo.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(promo.target)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface/60 p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-white/16"
      style={{ boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.02)" }}
    >
      {/* Accent glow, revealed on hover. */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: promo.accent }}
      />

      <div className="mb-3 flex items-start justify-between gap-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{ background: `color-mix(in oklab, ${promo.accent} 14%, transparent)`, borderColor: `color-mix(in oklab, ${promo.accent} 32%, transparent)` }}
        >
          <Icon className="h-5 w-5" style={{ color: promo.accent }} />
        </span>
        {promo.badge && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
            style={{ background: `color-mix(in oklab, ${promo.accent} 16%, transparent)`, color: promo.accent }}
          >
            {promo.badge}
          </span>
        )}
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">{promo.title}</p>
      <p className="mt-0.5 truncate text-sm text-white/70">{promo.tagline}</p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-mono text-base font-black tabular-nums" style={{ color: promo.accent }}>
          {promo.reward}
        </span>
        <span className="flex items-center gap-0.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-bold text-white/70 transition-colors group-hover:border-lime/40 group-hover:text-lime">
          {promo.cta}
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>

      <ul className="mt-3 space-y-1 border-t border-white/6 pt-3">
        {promo.requirements.map((req) => (
          <li key={req} className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: promo.accent }} />
            {req}
          </li>
        ))}
      </ul>
    </button>
  );
}

export function PromotionCards({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-base uppercase text-white">Promotions</h2>
          <span className="rounded-full bg-lime/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime">Official</span>
        </div>
        <span className="text-[11px] text-white/35">Claim and play — no hidden terms</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OFFICIAL_PROMOTIONS.map((promo) => (
          <PromoCard key={promo.id} promo={promo} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

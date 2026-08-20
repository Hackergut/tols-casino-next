"use client";

/*
 * Promotional cards — the official TOLS promotions, shown on the main screen
 * (visible pre sign-up / login, since the lobby renders behind the auth gate).
 *
 * Each card is a 16:9 art card in the same TOLS style as the game cards:
 * full-bleed promo artwork, a bottom scrim for legibility, the reward as a lime
 * badge, the hook tagline, and the same shimmer-sweep + hover lift language.
 */

import { useMemo, useState } from "react";
import { ArrowUpRight, Gift } from "lucide-react";
import { OFFICIAL_PROMOTIONS, type TolsPromotion } from "./promotions";

function PromoArt({ promo }: { promo: TolsPromotion }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="skeleton-shimmer absolute inset-0" />}
      <img
        src={promo.image}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full select-none object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}

function PromoCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = useMemo(() => promo.icon ?? Gift, [promo.icon]);
  return (
    <button
      type="button"
      onClick={() => onNavigate(promo.target)}
      aria-label={`${promo.title} — ${promo.reward}`}
      className="tols-promo-card group"
    >
      <PromoArt promo={promo} />

      {/* Shimmer sweep on hover, matching the game cards. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      {/* Icon chip (top-left) + reward badge (top-right). */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-black/45 backdrop-blur-md">
          <Icon className="h-4 w-4" style={{ color: promo.accent }} />
        </span>
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[11px] font-black tabular-nums backdrop-blur-md"
          style={{ background: "rgba(0,0,0,0.6)", color: promo.accent, border: `1px solid color-mix(in oklab, ${promo.accent} 40%, transparent)` }}
        >
          {promo.reward}
        </span>
      </div>

      {/* Bottom scrim: title + tagline + CTA. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-12">
        <p className="truncate text-[15px] font-bold text-white" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}>
          {promo.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/60" style={{ textShadow: "0 1px 5px rgb(0 0 0 / 0.7)" }}>
          {promo.tagline}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-lg border border-lime/40 bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime backdrop-blur-sm transition-colors group-hover:bg-lime group-hover:text-bg">
          {promo.cta} <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
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

      <div className="tols-promo-grid">
        {OFFICIAL_PROMOTIONS.map((promo) => (
          <PromoCard key={promo.id} promo={promo} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}

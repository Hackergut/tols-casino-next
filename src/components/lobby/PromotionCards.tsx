"use client";

/*
 * Promotional cards — the official TOLS promotions, shown on the main screen
 * (visible pre sign-up / login, since the lobby renders behind the auth gate).
 *
 * The section is a horizontal snap carousel (same shelf as the game rows, so
 * the next card always peeks and the arrows page by ~85% of the viewport).
 *
 * Each card is a 16:9 art card in the signature TOLS language so the brand is
 * readable in half a glance:
 *   · lime diagonal corner cut with the promo icon on dark ink
 *   · "TOLS" wordmark pill + oversized watermark
 *   · reward in Geist Mono lime (money is always mono + tabular)
 *   · bottom scrim with display-font title, tagline and lime CTA
 *   · the same shimmer-sweep + hover lift as the game cards
 *
 * Clicking a card opens its own info page (/promo/{id}) whose hero is the
 * same artwork — the card and the page always match.
 */

import { useMemo } from "react";
import { ArrowUpRight, ChevronRight, Gift } from "lucide-react";
import { Carousel } from "./Carousel";
import { ALL_PROMOTIONS, type TolsPromotion } from "./promotions";
import { promoSection } from "@/lib/casino-routes";

function PromoArt({ promo }: { promo: TolsPromotion }) {
  return (
    <>
      <div className="skeleton-shimmer absolute inset-0" />
      <img
        src={promo.image}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={(e) => (e.currentTarget.style.opacity = "1")}
        className="absolute inset-0 h-full w-full select-none object-cover opacity-0 transition-opacity duration-500"
      />
    </>
  );
}

function PromoCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = useMemo(() => promo.icon ?? Gift, [promo.icon]);
  return (
    <button
      type="button"
      onClick={() => onNavigate(promoSection(promo.id))}
      aria-label={`${promo.title} — ${promo.reward} — details`}
      className="tols-promo-card group"
    >
      <PromoArt promo={promo} />

      {/* Shimmer sweep on hover, matching the game cards. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      {/* Oversized TOLS watermark — the brand stamp behind the copy. */}
      <span
        aria-hidden
        className="tols-promo-watermark pointer-events-none absolute -bottom-3 right-2 select-none font-display font-black uppercase leading-none"
        style={{ fontSize: "clamp(2.75rem, 6vw, 4rem)", color: "rgba(204,255,0,0.16)", letterSpacing: "-0.02em", textShadow: "0 2px 18px rgb(0 0 0 / 0.6)" }}
      >
        TOLS
      </span>

      {/* Lime diagonal corner cut + icon chip (top-left). */}
      <div className="absolute left-0 top-0 flex items-center justify-center" style={{ width: 52, height: 52 }}>
        <div className="tols-promo-corner absolute inset-0" />
        <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-bg/85 shadow-[0_2px_12px_rgb(0_0_0/0.55)] ring-1 ring-lime/40">
          <Icon className="h-4 w-4 text-lime" />
        </span>
      </div>

      {/* TOLS wordmark pill (top-right). */}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        {promo.badge && (
          <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider backdrop-blur-md" style={{ color: promo.accent, border: `1px solid color-mix(in oklab, ${promo.accent} 45%, transparent)`, background: "rgba(0,0,0,0.55)" }}>
            {promo.badge}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full border border-lime/30 bg-black/50 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-widest text-lime backdrop-blur-md">
          TOLS
        </span>
      </div>

      {/* Bottom scrim: reward strip + title + tagline + CTA. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent p-3 pt-14">
        <p className="tols-promo-reward flex items-center gap-1.5 font-mono text-sm font-black tabular-nums text-lime" style={{ textShadow: "0 0 18px rgb(204 255 0 / 0.35), 0 1px 6px rgb(0 0 0 / 0.8)" }}>
          <span className="h-3 w-1 shrink-0 rounded-full bg-lime" />
          {promo.reward}
        </p>
        <p className="mt-1 truncate font-display text-[15px] font-bold uppercase tracking-wide text-white" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}>
          {promo.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-white/60" style={{ textShadow: "0 1px 5px rgb(0 0 0 / 0.7)" }}>
          {promo.tagline}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-lg border border-lime/40 bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime backdrop-blur-sm transition-colors group-hover:bg-lime group-hover:text-bg">
          Details <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>

      {/* Lime accent hairline along the bottom edge — brand signature. */}
      <div className="tols-promo-edge absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-lime via-lime/60 to-transparent" />
    </button>
  );
}

export function PromotionCards({ onNavigate }: { onNavigate: (target: string) => void }) {
  return (
    <section className="space-y-3">
      <Carousel
        title="Promotions"
        subtitle="Every official TOLS offer — tap a card for full details"
        size="xl"
        icon={
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-lime/25 bg-lime/10">
            <Gift className="h-4 w-4 text-lime" />
          </span>
        }
        action={
          <button
            onClick={() => onNavigate("promotions")}
            className="flex items-center gap-1 rounded-full border border-lime/30 bg-lime/8 px-3.5 py-2 text-xs font-bold text-lime transition-colors hover:bg-lime hover:text-bg"
          >
            All promos <ChevronRight className="h-3.5 w-3.5" />
          </button>
        }
      >
        {ALL_PROMOTIONS.map((promo) => (
          <PromoCard key={promo.id} promo={promo} onNavigate={onNavigate} />
        ))}
      </Carousel>
    </section>
  );
}

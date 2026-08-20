"use client";

/*
 * Promotional cards — the official TOLS promotions, shown on the main screen
 * (visible pre sign-up / login, since the lobby renders behind the auth gate).
 *
 * The section is a horizontal snap carousel (same shelf as the game rows, so
 * the next card always peeks and the arrows page by ~85% of the viewport).
 *
 * Each card is a 16:9 art card whose chrome is EXACTLY the game-card language
 * (LobbyGameCard): painted artwork, lime "Original"-style kind pill top-left,
 * badge pill top-right, lime play circle revealed on hover, and the bottom
 * gradient bar with display title, kind · tagline meta and the reward as a
 * mono-lime chip — the same slot the RTP chip occupies on game cards.
 *
 * Clicking a card opens its own info page (/promo/{id}) whose hero is the
 * same artwork — the card and the page always match.
 */

import { useMemo, type CSSProperties } from "react";
import { ArrowUpRight, ChevronRight, Gift } from "lucide-react";
import { Carousel } from "./Carousel";
import { ALL_PROMOTIONS, type TolsPromotion } from "./promotions";
import { promoSection } from "@/lib/casino-routes";

/* Same type scale as LobbyGameCard so the two cards read as one family. */
const TITLE_STYLE: CSSProperties = {
  fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)",
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  textShadow: "0 1px 6px rgb(0 0 0 / 0.75)",
};
const META_STYLE: CSSProperties = {
  fontSize: "clamp(0.75rem, 0.7rem + 0.24vw, 0.875rem)",
  lineHeight: 1.25,
  textShadow: "0 1px 5px rgb(0 0 0 / 0.7)",
};

const KIND_LABEL: Record<string, string> = {
  welcome: "Welcome",
  rakeback: "Rakeback",
  reload: "Reload",
  cashback: "Cashback",
  jackpot: "Jackpot",
  referral: "Referral",
  campaign: "Campaign",
};

function PromoArt({ image }: { image: string }) {
  return (
    <>
      <div className="skeleton-shimmer absolute inset-0" />
      <img
        src={image}
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

export function PromoCard({ promo, onNavigate }: { promo: TolsPromotion; onNavigate: (target: string) => void }) {
  const Icon = useMemo(() => promo.icon ?? Gift, [promo.icon]);
  const kind = KIND_LABEL[promo.kind] ?? promo.kind;

  return (
    <button
      type="button"
      onClick={() => onNavigate(promoSection(promo.id))}
      aria-label={`${promo.title} — ${promo.reward} — details`}
      className="tols-game-card group"
    >
      <PromoArt image={promo.image} />

      {/* Shimmer sweep on hover, matching the game cards. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      {/* Top-left: lime kind pill, same slot as the "Original" pill. */}
      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        <span className="tols-game-pill tols-game-pill-original">{kind}</span>
      </div>

      {/* Top-right: badge pill (Live/New/Hot language). */}
      {promo.badge && (
        <span className="absolute right-2.5 top-2.5 tols-game-pill tols-game-pill-new">{promo.badge}</span>
      )}

      {/* Center play circle revealed on hover — same as game cards, arrow = details. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="tols-game-play">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>

      {/* Bottom bar: title + meta left, reward chip right (RTP-chip slot). */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-14">
        <div className="min-w-0">
          <p className="truncate font-bold text-white" style={TITLE_STYLE}>{promo.title}</p>
          <p className="truncate text-white/60" style={META_STYLE}>
            {kind} · {promo.tagline}
          </p>
        </div>
        <span className="flex max-w-[118px] shrink-0 items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-lime">
          <Icon className="h-3 w-3 shrink-0 text-lime/80" />
          <span className="truncate">{promo.reward}</span>
        </span>
      </div>
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

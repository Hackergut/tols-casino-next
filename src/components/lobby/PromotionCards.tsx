"use client";

/*
 * Promotional cards — TOLS × Apple design system.
 *
 * Built on the Apple design skill (Designing Fluid Interfaces distilled):
 *
 *  · Response — feedback fires on pointer-*down*, not release: the card
 *    presses (scale 0.97) the instant the finger lands, and touch-action:
 *    manipulation kills the 300 ms tap delay.
 *  · Interruptibility — every transform is a critically damped spring
 *    (bounce 0 ≈ damping 1.0, response ~0.4 s). Springs start from the
 *    current on-screen value, so a press can be cancelled mid-flight and a
 *    hover can be re-targeted without a hard cut. No CSS keyframes on the
 *    interactive card itself.
 *  · Materials & depth — chrome is a translucent material: backdrop blur +
 *    saturate, a bright 1px top edge (light catching the glass) and heavier
 *    shadows under the art. Color (the lime reward) lives on a SOLID chip,
 *    never the translucent foreground, so legibility holds over any art.
 *  · Typography — size-specific tracking: the title tightens as it grows
 *    (-0.02em, leading 1.12); small labels open up (+0.08em uppercase).
 *    Numbers stay mono + tabular.
 *  · Spatial consistency — the center affordance anchors to the card and
 *    points at the destination (↗); the detail page hero is the same card
 *    dressed statically, so the card → page jump is seamless.
 *  · Reduced motion & transparency — springs collapse to static, glass goes
 *    frosty/solid.
 */

import { useMemo } from "react";
import { ArrowUpRight, ChevronRight, Gift } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Carousel } from "./Carousel";
import { ALL_PROMOTIONS, PROMO_KIND_LABEL, type TolsPromotion } from "./promotions";
import { promoSection } from "@/lib/casino-routes";

/* House spring — critically damped (Apple: damping 1.0, response ≈ 0.4). */
const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;

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
  const reduced = useReducedMotion();
  const Icon = useMemo(() => promo.icon ?? Gift, [promo.icon]);
  const kind = PROMO_KIND_LABEL[promo.kind] ?? promo.kind;

  return (
    <motion.button
      type="button"
      onClick={() => onNavigate(promoSection(promo.id))}
      aria-label={`${promo.title} — ${promo.reward} — details`}
      className="tols-promo-card group"
      whileHover={reduced ? undefined : { y: -4 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={SPRING}
    >
      <PromoArt image={promo.image} />

      {/* Shimmer sweep on hover — subtle, never on the input path. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent transition-all duration-700 group-hover:left-full" />
      </div>

      {/* Kind pill (top-left) — translucent material, lime accent. */}
      <div className="tols-promo-pill tols-promo-pill-kind absolute left-3 top-3">
        <Icon className="h-3 w-3" />
        {kind}
      </div>

      {/* Badge pill (top-right) — translucent material. */}
      {promo.badge && (
        <div className="tols-promo-pill tols-promo-pill-badge absolute right-3 top-3">{promo.badge}</div>
      )}

      {/* Center affordance — glass play circle, revealed on hover. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="tols-promo-play">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>

      {/* Bottom translucent bar: title + meta left, solid lime reward right. */}
      <div className="tols-promo-bar">
        <div className="min-w-0">
          <p className="tols-promo-title truncate">{promo.title}</p>
          <p className="tols-promo-meta truncate">
            {kind} · {promo.tagline}
          </p>
        </div>
        <span className="tols-promo-reward" title={promo.reward}>
          {promo.reward}
        </span>
      </div>
    </motion.button>
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
          <span className="tols-promo-pill tols-promo-pill-kind h-8 w-8 justify-center !p-0">
            <Gift className="h-4 w-4" />
          </span>
        }
        action={
          <button
            onClick={() => onNavigate("promotions")}
            className="tols-promo-pill tols-promo-pill-cta"
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

"use client";

/*
 * Hero promo carousel.
 *
 * Slides advance on their own so the lobby feels alive without the player
 * doing anything, but autoplay is a suggestion, not a fight: it pauses while
 * the pointer is over the hero, while the tab is hidden, and permanently once
 * the player takes manual control. It is disabled outright when the system
 * asks for reduced motion, where a moving banner is actively unpleasant.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Promo {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  target: string;
}

export const PROMOS: Promo[] = [
  { id: "dice-duel", title: "Dice Duel", subtitle: "TOLS Original · 99% RTP", cta: "Play", image: "/games/originals/dice.jpg", target: "dice" },
  { id: "blackjack", title: "Blackjack", subtitle: "Classic 21 · blackjack pays 3:2", cta: "Deal", image: "/games/originals/blackjack.jpg", target: "blackjack" },
  { id: "pool-rush", title: "Pool Rush", subtitle: "New Original · break the rack for multipliers", cta: "Break", image: "/games/originals/pool-rush.jpg", target: "pool-rush" },
  { id: "tols-roulette", title: "TOLS Roulette", subtitle: "European single zero · 97.3% RTP", cta: "Play", image: "/games/originals/roulette.jpg", target: "roulette" },
  { id: "neon-sevens", title: "Neon Sevens", subtitle: "Three reels, one payline · 97% RTP", cta: "Spin", image: "/games/originals/slots.jpg", target: "slots" },
  { id: "chip-storm", title: "Chip Storm", subtitle: "Flip a chip, double your stake", cta: "Play", image: "/games/originals/coinflip.jpg", target: "coinflip" },
];

const INTERVAL = 5200;

export function HeroCarousel({ onSelect }: { onSelect: (target: string) => void }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const manual = useRef(false);

  const go = useCallback((next: number, byUser = false) => {
    if (byUser) manual.current = true;
    setDir(next > index || (index === PROMOS.length - 1 && next === 0) ? 1 : -1);
    setIndex((next + PROMOS.length) % PROMOS.length);
  }, [index]);

  // Autoplay — stops for reduced motion, hidden tabs, hover, or manual control.
  useEffect(() => {
    if (reduced || paused || manual.current) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      setDir(1);
      setIndex((i) => (i + 1) % PROMOS.length);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [reduced, paused]);

  const promo = PROMOS[index];

  const slide = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -40 : 40 }),
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Promotions"
    >
      <div className="relative h-[210px] sm:h-[280px]">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={promo.id}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <img src={promo.image} alt="" aria-hidden className="h-full w-full object-cover" />
            {/* Idle spark grid — low-contrast brand texture (css-motion-designer
                recipe; disabled under reduced motion). */}
            <div aria-hidden className="idle-spark-grid pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay" />
            {/* Scrim keeps the copy legible over any part of the art. */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, #0f1015 10%, transparent 68%), linear-gradient(0deg, #0f1015 6%, transparent 58%)" }}
            />
            <div className="absolute inset-0 flex flex-col justify-end gap-1 p-5 pr-16">
              <motion.h2
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="font-display uppercase leading-none text-white"
                style={{ fontSize: "clamp(1.375rem, 1.05rem + 1.5vw, 2.25rem)", textShadow: "0 2px 14px rgb(0 0 0 / 0.8)" }}
              >
                {promo.title}
              </motion.h2>
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                className="flex items-end justify-between gap-3"
              >
                <p className="text-white/70" style={{ fontSize: "clamp(0.75rem, 0.68rem + 0.35vw, 0.9375rem)", textShadow: "0 1px 8px rgb(0 0 0 / 0.75)" }}>{promo.subtitle}</p>
                <button
                  onClick={() => onSelect(promo.target)}
                  className="shrink-0 rounded-xl border-2 border-lime px-5 py-2.5 font-black uppercase tracking-wide text-lime transition-colors hover:bg-lime hover:text-bg sm:px-6"
                  style={{ fontSize: "clamp(0.75rem, 0.7rem + 0.25vw, 0.9375rem)" }}
                >
                  {promo.cta}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        <button
          onClick={() => go(index - 1, true)}
          aria-label="Promozione precedente"
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 backdrop-blur-sm transition-colors hover:text-lime"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => go(index + 1, true)}
          aria-label="Promozione successiva"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white/70 backdrop-blur-sm transition-colors hover:text-lime"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Progress dots — the active one fills over the autoplay interval. */}
      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
        {PROMOS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => go(i, true)}
            aria-label={`Vai a ${p.title}`}
            aria-current={i === index}
            className="h-1 overflow-hidden rounded-full transition-all"
            style={{ width: i === index ? 22 : 8, background: i === index ? "transparent" : "rgb(255 255 255 / 0.25)" }}
          >
            {i === index && (
              <motion.span
                key={`${p.id}-bar`}
                className="block h-full rounded-full bg-lime"
                initial={{ width: reduced || manual.current ? "100%" : 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: reduced || manual.current || paused ? 0 : INTERVAL / 1000, ease: "linear" }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

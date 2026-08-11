"use client";

/*
 * Carousel — a horizontal shelf calibrated to Apple HIG.
 *
 *  · scroll-snap so cards always land aligned (App Store shelf behaviour)
 *  · 44×44pt arrow controls, auto-disabled at each end
 *  · native momentum/trackpad/touch scrolling — arrows are an addition, not
 *    the only way to move
 *  · the next card peeks, signalling scrollability without extra chrome
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { HIT_TARGET, SPACE, cardWidth, type CardSize } from "./design-tokens";

interface CarouselProps {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  size?: CardSize;
  children: ReactNode[];
}

export function Carousel({ title, icon, action, size = "medium", children }: CarouselProps) {
  const reduced = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // Tolerance absorbs the container's inline padding and sub-pixel rounding,
    // so the arrows disable exactly at each end.
    const TOL = 12;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= TOL);
    setAtEnd(el.scrollLeft >= max - TOL);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync, children.length]);

  // Page by ~85% of the viewport so a partially-seen card is never skipped.
  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  const arrow = (dir: 1 | -1, disabled: boolean) => (
    <button
      onClick={() => page(dir)}
      disabled={disabled}
      aria-label={dir === -1 ? "Scorri a sinistra" : "Scorri a destra"}
      className="flex shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition-all hover:border-lime/40 hover:text-lime disabled:pointer-events-none disabled:opacity-25"
      style={{ width: HIT_TARGET, height: HIT_TARGET }}
    >
      {dir === -1 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
    </button>
  );

  return (
    <section>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            {title && <h2 className="font-display truncate text-base uppercase text-white">{title}</h2>}
          </div>
          <div className="flex shrink-0 items-center" style={{ gap: SPACE.sm }}>
            {action}
            {arrow(-1, atStart)}
            {arrow(1, atEnd)}
          </div>
        </header>
      )}

      <div
        ref={scroller}
        className="scrollbar-hide -mx-1 flex overflow-x-auto px-1 pb-1"
        style={{
          gap: SPACE.base,
          scrollSnapType: "x mandatory",
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children.map((child, i) => (
          <motion.div
            key={i}
            className="shrink-0"
            style={{ width: cardWidth(size), scrollSnapAlign: "start" }}
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 120px 0px 0px" }}
            // Stagger only the first screenful; later cards appear as they
            // scroll in, so a long shelf never feels like it is loading slowly.
            transition={{ delay: Math.min(i, 5) * 0.055, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {child}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

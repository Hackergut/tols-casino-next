"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import { springs } from "@/casino/lib/motion";
import { formatCurrency } from "@/lib/types";

/** Odometer text: each digit rolls vertically when it changes. */
export function OdometerText({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <span className={`font-mono tabular-nums ${className ?? ""}`}>{text}</span>;
  }
  return (
    <span className={`inline-flex font-mono tabular-nums ${className ?? ""}`} aria-label={text}>
      {text.split("").map((ch, i) => (
        <span
          key={`${text.length}-${i}`}
          className="relative inline-block overflow-hidden"
          style={{ width: /[0-9]/.test(ch) ? "1ch" : undefined }}
          aria-hidden="true"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              className="inline-block"
              initial={{ y: "-100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={springs.snappy}
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

// Animated ticking jackpot display. Shows the prop amount and continuously
// ticks upward to feel "live". The tick increment is pure local state that
// only ever increases inside the interval callback (no setState in effect body).
export function JackpotTicker({ amount, compact = false }: { amount: number; compact?: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => {
      setTick((t) => t + Math.random() * 1.8 + 0.4);
    }, 1500);
    return () => clearInterval(i);
  }, []);

  const display = amount + tick;

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "flex-col sm:flex-row"}`}>
      <div className="flex items-center gap-1.5">
        <Trophy className="h-4 w-4 text-lime" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Mega Drop</span>
      </div>
      <OdometerText
        text={formatCurrency(display)}
        className={`font-bold text-lime ${compact ? "text-sm" : "text-lg sm:text-xl"}`}
      />
    </div>
  );
}

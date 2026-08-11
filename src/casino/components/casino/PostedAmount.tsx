"use client";

// The signature element: money typeset as a ledger. Digits roll to the settled
// value, a hairline draws beneath, a lime tick "posts" the entry. Used on every
// surface money appears: balance, live bets, cashouts, history.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";
import { springs, EASE_OUT_EXPO } from "@/casino/lib/motion";

interface PostedAmountProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
  /** roll duration in seconds */
  duration?: number;
}

export function PostedAmount({ value, format, className, duration = 0.4 }: PostedAmountProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const [posted, setPosted] = useState(false);
  const prev = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    const from = prev.current;
    prev.current = value;
    const post = () => {
      setPosted(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPosted(false), 900);
    };
    if (reduced) {
      setDisplay(value);
      post();
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => setDisplay(v),
      onComplete: post,
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fmt = format ?? ((n: number) => n.toFixed(2));

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
        <span>{fmt(display)}</span>
        <AnimatePresence>
          {posted && (
            <motion.svg
              width={11}
              height={11}
              viewBox="0 0 18 18"
              className="shrink-0 text-lime"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springs.snappy}
            >
              <path d="M3 9.5 L7 13.5 L15 4.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence>
        {posted && (
          <motion.span
            className="absolute -bottom-0.5 left-0 right-0 h-px origin-left bg-gradient-to-r from-lime via-lime/25 to-transparent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

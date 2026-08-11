"use client";

// Phase 5 — celebration system on Framer Motion, four tiers:
// small (<2x): inline pulse chip, no overlay. medium (2-10x): confetti burst,
// card glow. big (10-50x): overlay, coin shower, counter roll-up, screen dim.
// massive (50x+): + radial shockwave, letterbox bars, sustained particles.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, animate, useReducedMotion } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { springs, EASE_OUT_EXPO } from "@/casino/lib/motion";

type Tier = "small" | "medium" | "big" | "massive";

function tierOf(mult: number): Tier {
  if (mult >= 50) return "massive";
  if (mult >= 10) return "big";
  if (mult >= 2) return "medium";
  return "small";
}

const TIER_DURATION: Record<Tier, number> = { small: 1400, medium: 2600, big: 4200, massive: 5200 };
const TIER_LABEL: Record<Tier, string> = { small: "Nice hit", medium: "You Win!", big: "Big Win!", massive: "MASSIVE WIN" };

function CountUp({ to, duration }: { to: number; duration: number }) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) { setV(to); return; }
    const c = animate(0, to, { duration, ease: EASE_OUT_EXPO, onUpdate: setV });
    return () => c.stop();
  }, [to, duration, reduced]);
  return <span>{v.toFixed(2)}</span>;
}

function frac(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function WinCelebration({ trigger }: { trigger: { payout: number; multiplier: number } | null }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<{ payout: number; multiplier: number; tier: Tier; key: number } | null>(null);

  useEffect(() => {
    if (trigger && trigger.payout > 0) {
      const tier = tierOf(trigger.multiplier);
      setActive({ ...trigger, tier, key: Date.now() });
      const t = setTimeout(() => setActive(null), TIER_DURATION[tier]);
      return () => clearTimeout(t);
    }
  }, [trigger]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  // Particle budget: hard cap 50 under 768px (quality floor)
  const counts = useMemo(() => {
    if (!active || reduced) return { confetti: 0, coins: 0, ambient: 0 };
    const scale = isMobile ? 0.5 : 1;
    if (active.tier === "medium") return { confetti: Math.floor(28 * scale), coins: 0, ambient: 0 };
    if (active.tier === "big") return { confetti: Math.floor(20 * scale), coins: Math.floor(24 * scale), ambient: 0 };
    if (active.tier === "massive") return { confetti: Math.floor(24 * scale), coins: Math.floor(30 * scale), ambient: Math.floor(14 * scale) };
    return { confetti: 0, coins: 0, ambient: 0 };
  }, [active, reduced, isMobile]);

  return (
    <AnimatePresence>
      {active && active.tier === "small" && (
        // Small: inline pulse chip — never interrupts play
        <motion.div
          key={active.key}
          className="pointer-events-none fixed bottom-6 right-6 z-[100]"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={springs.snappy}
        >
          <div className="flex items-center gap-2 rounded-lg border border-lime/30 bg-background/95 px-4 py-2 shadow-[0_0_24px] shadow-lime/20 backdrop-blur-xl">
            <span className="font-mono text-sm font-bold tabular-nums text-lime">+${active.payout.toFixed(2)}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{active.multiplier.toFixed(2)}×</span>
          </div>
        </motion.div>
      )}

      {active && active.tier !== "small" && (
        <motion.div
          key={active.key}
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          {/* Screen dim (big+) */}
          {(active.tier === "big" || active.tier === "massive") && (
            <motion.div className="absolute inset-0 bg-black" initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} />
          )}

          {/* Letterbox bars (massive) */}
          {active.tier === "massive" && !reduced && (
            <>
              <motion.div className="absolute inset-x-0 top-0 h-[9vh] origin-top bg-black" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.5, ease: EASE_OUT_EXPO }} />
              <motion.div className="absolute inset-x-0 bottom-0 h-[9vh] origin-bottom bg-black" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }} transition={{ duration: 0.5, ease: EASE_OUT_EXPO }} />
            </>
          )}

          {/* Radial shockwave (massive) */}
          {active.tier === "massive" && !reduced && (
            <motion.div
              className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime"
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 14, opacity: 0 }}
              transition={{ duration: 1.1, ease: EASE_OUT_EXPO }}
            />
          )}

          {/* Confetti burst from the win origin (center) */}
          {counts.confetti > 0 && (
            <div className="absolute left-1/2 top-1/2">
              {Array.from({ length: counts.confetti }).map((_, i) => {
                const angle = (i / counts.confetti) * Math.PI * 2 + frac(i, 1) * 0.6;
                const dist = 90 + frac(i, 2) * 190;
                const isLime = i % 3 !== 2;
                return (
                  <motion.span
                    key={i}
                    className="absolute h-2 w-2"
                    style={{ background: isLime ? "var(--color-lime)" : "var(--vip)", borderRadius: i % 2 ? "50%" : "1px" }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: [0, Math.sin(angle) * dist - 40, Math.sin(angle) * dist + 140],
                      rotate: frac(i, 3) * 540,
                      opacity: [1, 1, 0],
                      scale: 0.6,
                    }}
                    transition={{ duration: 1.5 + frac(i, 4) * 0.8, ease: "easeOut", delay: frac(i, 5) * 0.15 }}
                  />
                );
              })}
            </div>
          )}

          {/* Coin shower (big+) */}
          {counts.coins > 0 && (
            <div className="absolute inset-0">
              {Array.from({ length: counts.coins }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute top-[-4vh] h-3.5 w-3.5 rounded-full"
                  style={{
                    left: `${frac(i, 6) * 100}%`,
                    background: "linear-gradient(145deg, #f5d456, #d4a017 60%, #8a6d0b)",
                    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), 0 0 6px color-mix(in oklab, var(--color-pending) 35%, transparent)",
                  }}
                  initial={{ y: 0, opacity: 0, rotateX: 0 }}
                  animate={{ y: "112vh", opacity: [0, 1, 1, 0.8], rotateX: 720 + frac(i, 7) * 720 }}
                  transition={{ duration: 1.6 + frac(i, 8) * 1.4, ease: "easeIn", delay: frac(i, 9) * 0.9 }}
                />
              ))}
            </div>
          )}

          {/* Sustained ambient particles (massive) */}
          {counts.ambient > 0 && (
            <div className="absolute inset-0">
              {Array.from({ length: counts.ambient }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute h-1.5 w-1.5 rounded-full bg-lime"
                  style={{ left: `${frac(i, 10) * 100}%`, top: `${20 + frac(i, 11) * 70}%`, opacity: 0.5 }}
                  animate={{ y: [-8, -60 - frac(i, 12) * 60], opacity: [0, 0.6, 0] }}
                  transition={{ duration: 2.2 + frac(i, 13), repeat: Infinity, delay: frac(i, 14) * 1.5, ease: "easeOut" }}
                />
              ))}
            </div>
          )}

          {/* Win card */}
          <motion.div
            className="pointer-events-auto relative flex flex-col items-center rounded-2xl border-2 border-lime bg-background/95 px-8 py-6 backdrop-blur-xl"
            style={{ boxShadow: active.tier === "medium" ? "0 0 40px color-mix(in oklab, var(--color-lime) 30%, transparent)" : "0 0 80px color-mix(in oklab, var(--color-lime) 45%, transparent)" }}
            initial={reduced ? { opacity: 0 } : { scale: 0.55, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
            transition={springs.bounce}
          >
            <button
              onClick={() => setActive(null)}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>

            <Trophy className={`mb-2 text-lime ${active.tier === "massive" ? "h-12 w-12" : "h-10 w-10"}`} />

            <div className={`font-bold uppercase tracking-wide text-lime ${active.tier === "massive" ? "text-4xl" : "text-3xl"}`}>
              {TIER_LABEL[active.tier]}
            </div>

            {/* Counter roll-up, posted when settled */}
            <div className="mt-1 font-mono text-4xl font-bold tabular-nums text-lime">
              +$<CountUp to={active.payout} duration={active.tier === "medium" ? 0.6 : 1.1} />
            </div>
            <motion.div
              className="mt-1 h-px w-full origin-left bg-gradient-to-r from-lime via-lime/25 to-transparent"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: reduced ? 0 : active.tier === "medium" ? 0.65 : 1.15, duration: 0.3, ease: EASE_OUT_EXPO }}
            />

            <div className="mt-2 font-mono text-lg tabular-nums text-muted-foreground">
              {active.multiplier.toFixed(2)}× multiplier
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

// Phase 5 — achievement toast on the same physics language as WinCelebration.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Trophy, Sparkles } from "lucide-react";
import { springs } from "@/casino/lib/motion";

interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  unlocked: boolean;
  category: string;
}

interface AchievementsData {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
  totalUnlocked: number;
  totalAchievements: number;
}

export function AchievementToast() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);
  const reduced = useReducedMotion();

  const { data } = useQuery<AchievementsData>({
    queryKey: ["achievements-check"],
    queryFn: async () => {
      const r = await fetch("/api/achievements");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 8000, // check every 8 seconds
  });

  // When new unlocks are detected, add them to the queue.
  // Uses a ref to track the last-seen data to avoid setState-in-effect.
  const lastCheckedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.newlyUnlocked) return;
    const signature = data.newlyUnlocked.map((a) => a.id).join(",");
    if (signature === lastCheckedRef.current) return;
    lastCheckedRef.current = signature;
    if (data.newlyUnlocked.length > 0) {
      const timer = setTimeout(() => {
        setQueue((prev) => {
          const existing = new Set(prev.map((a) => a.id));
          const fresh = data.newlyUnlocked.filter((a) => !existing.has(a.id));
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data]);

  // Process the queue — show one toast at a time, auto-dismiss after 5s
  useEffect(() => {
    if (!current && queue.length > 0) {
      const t = setTimeout(() => {
        const [next, ...rest] = queue;
        setCurrent(next);
        setQueue(rest);
      }, 50);
      return () => clearTimeout(t);
    }
    if (current) {
      const t = setTimeout(() => setCurrent(null), 5000);
      return () => clearTimeout(t);
    }
  }, [current, queue]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          className="fixed left-1/2 top-20 z-[110] -translate-x-1/2"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: -36, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.95 }}
          transition={springs.soft}
        >
          <div className="relative flex items-center gap-3 rounded-xl border-2 border-lime bg-background/95 px-5 py-3 shadow-[0_0_40px] shadow-lime/30 backdrop-blur-xl">
            <button
              onClick={() => setCurrent(null)}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Icon with spring pop */}
            <motion.div
              className="relative flex h-12 w-12 items-center justify-center"
              initial={reduced ? false : { scale: 0.4, rotate: -18 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...springs.bounce, delay: 0.12 }}
            >
              <div className="pulse-glow absolute inset-0 rounded-full bg-lime/20" />
              <span className="relative text-3xl">{current.icon}</span>
            </motion.div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-lime" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-lime">Achievement Unlocked!</span>
                <Sparkles className="h-3 w-3 text-lime" />
              </div>
              <div className="text-lg font-bold uppercase tracking-wide text-lime">{current.name}</div>
              <div className="text-xs text-muted-foreground">{current.desc}</div>
            </div>

            {/* Dismiss progress */}
            <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-xl">
              <motion.div
                className="h-full origin-left bg-lime"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5, ease: "linear" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

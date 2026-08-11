"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trophy, TrendingUp } from "lucide-react";
import { springs } from "@/casino/lib/motion";
import { formatCurrency, timeAgo } from "@/lib/types";

interface Bet {
  id: string;
  username: string;
  avatarColor: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: "win" | "lose";
  createdAt: string;
}

export function LiveBetsFeed() {
  const reduced = useReducedMotion();
  const { data } = useQuery<Bet[]>({
    queryKey: ["live-bets"],
    queryFn: async () => {
      const r = await fetch("/api/bets?limit=20");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 4000,
  });

  return (
    <div className="flex flex-col rounded-lg border border-border/50 bg-card/40">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Bets</span>
        </div>
        <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="max-h-80 overflow-y-auto">
        <AnimatePresence initial={false} mode="popLayout">
          {data?.map((bet) => {
            const won = bet.result === "win";
            return (
              <motion.div
                key={bet.id}
                layout
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={reduced ? { duration: 0 } : springs.soft}
                className="flex items-center gap-2 border-b border-border/30 px-3 py-1.5 text-xs transition-colors hover:bg-secondary/30"
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-bg"
                  style={{ background: bet.avatarColor }}
                >
                  {bet.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-medium">{bet.username}</span>
                    <span className="text-muted-foreground">· {bet.gameName}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{timeAgo(bet.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold tabular-nums">{formatCurrency(bet.amount)}</div>
                  <div className={`flex items-center justify-end gap-0.5 text-[10px] ${won ? "text-win" : "text-loss"}`}>
                    <TrendingUp className="h-2.5 w-2.5" />
                    {won ? `${bet.multiplier.toFixed(2)}×` : "—"}
                  </div>
                </div>
                <div className={`w-16 text-right font-mono text-xs font-bold tabular-nums ${won ? "text-win" : "text-muted-foreground"}`}>
                  {won ? "+" + formatCurrency(bet.payout) : "—"}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

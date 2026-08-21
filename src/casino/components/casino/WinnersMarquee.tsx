"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/types";
import { usePublicEvent } from "@/hooks/use-realtime";

interface Winner {
  id: string;
  username: string;
  avatarColor: string;
  gameName: string;
  amount: number;
  multiplier: number;
  payout: number;
  createdAt: string;
}

export function WinnersMarquee() {
  // Live big wins pushed over the public SSE stream take the front of the
  // marquee; the fetched list seeds it. The poll drops to 60s because it only
  // needs to repair the list after a missed stretch (tab asleep, reconnect).
  const [live, setLive] = useState<Winner[]>([]);
  const { data: winners } = useQuery<Winner[]>({
    queryKey: ["winners"],
    queryFn: async () => {
      const r = await fetch("/api/winners");
      const j = await r.json();
      return j.data;
    },
    refetchInterval: 60000,
  });

  usePublicEvent<Winner>("winner:new", (w) => {
    if (!w?.id) return;
    setLive((prev) => (prev.some((x) => x.id === w.id) ? prev : [w, ...prev].slice(0, 10)));
  });

  const items = [...live, ...(winners || []).filter((w) => !live.some((l) => l.id === w.id))];

  if (items.length === 0) return null;

  // Duplicate for seamless marquee loop
  const loop = [...items, ...items];

  return (
    <div className="relative flex items-center gap-2 overflow-hidden border-y border-border/40 bg-card/30 py-1.5">
      <div className="flex shrink-0 items-center gap-1.5 border-r border-border/40 pr-3 pl-3 sm:pl-4">
        <Trophy className="h-3.5 w-3.5 text-lime" />
        <span className="hidden text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:inline">
          Big Wins
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-6">
          {loop.map((w, i) => (
            <div key={`${w.id}-${i}`} className="flex shrink-0 items-center gap-1.5 text-xs">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-bg"
                style={{ background: w.avatarColor }}
              >
                {w.username.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-semibold text-foreground/90">{w.username}</span>
              <span className="text-muted-foreground">won</span>
              <span className="font-mono font-bold tabular-nums text-lime">
                {formatCurrency(w.payout)}
              </span>
              <span className="text-muted-foreground">on</span>
              <span className="font-medium text-foreground/80">{w.gameName}</span>
              <span className="flex items-center gap-0.5 rounded bg-lime/10 px-1 font-mono text-[9px] font-bold text-lime">
                <Sparkles className="h-2 w-2" />
                {w.multiplier.toFixed(2)}×
              </span>
            </div>
          ))}
        </div>
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { GameCard } from "../GameCard";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { springs } from "@/casino/lib/motion";

interface Game {
  id: string; slug: string; name: string; provider: string; category: string; image: string; rtp: number; featured: boolean; popularity: number; description: string;
}

const PROVIDER_FILTERS = ["All", "TOLS Originals", "TOLS Studios", "Pragmatic", "Hacksaw", "Evolution", "Relax", "Spribe", "Evoplay"];

export function GamesGrid({
  title,
  subtitle,
  category,
  icon: Icon,
  onSelectGame,
}: {
  title: string;
  subtitle: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelectGame: (slug: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("All");
  const reduced = useReducedMotion();

  const { data: games } = useQuery<Game[]>({
    queryKey: ["games", category],
    queryFn: async () => {
      const r = await fetch(`/api/games?category=${category}`);
      const j = await r.json();
      return j.data;
    },
  });

  const filtered = (games || []).filter((g) => {
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (provider !== "All" && g.provider !== provider) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-lime/20 bg-lime/5">
            <Icon className="h-4 w-4 text-lime" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">{title}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games…"
              className="h-9 w-40 pl-8 text-sm sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Provider filters — sliding layoutId pill */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {PROVIDER_FILTERS.map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={cn(
              "relative shrink-0 rounded-full border border-transparent px-3 py-1 text-xs font-medium transition-colors duration-[var(--dur-fast)]",
              provider === p ? "text-lime" : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {provider === p && (
              <motion.span
                layoutId="provider-pill"
                transition={reduced ? { duration: 0 } : springs.snappy}
                className="absolute inset-0 rounded-full border border-lime/40 bg-lime/10"
              />
            )}
            <span className="relative z-10">{p}</span>
          </button>
        ))}
      </div>

      {/* Grid — staggered mount, layout animation on filter change */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/50 bg-card/30 py-16 text-center">
          <p className="text-sm text-muted-foreground">No games found matching your filters.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((g, i) => (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={reduced ? { duration: 0 } : { ...springs.soft, delay: Math.min(i * 0.02, 0.24) }}
              >
                <GameCard
                  slug={g.slug}
                  name={g.name}
                  provider={g.provider}
                  category={g.category}
                  image={g.image}
                  rtp={g.rtp}
                  featured={g.featured}
                  popularity={g.popularity}
                  onClick={() => onSelectGame(g.slug)}
                  className="w-full"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <p className="pt-2 text-center text-xs text-muted-foreground">
        Showing {filtered.length} games · {category === "originals" ? "Click any game to play instantly" : "Third-party games open in a launch modal"}
      </p>
    </div>
  );
}

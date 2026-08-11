"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Search, Gamepad2, Trophy, Users, Navigation, Dices, ArrowRight } from "lucide-react";
import { useUIStore } from "@/lib/store";
import { formatCurrency } from "@/lib/types";

interface SearchResult {
  games: Array<{ id: string; slug: string; name: string; provider: string; category: string; image: string; rtp: number }>;
  tournaments: Array<{ id: string; name: string; game: string; prizePool: number; status: string; bannerColor: string }>;
  players: Array<{ id: string; username: string; avatarColor: string; level: number }>;
  sections: Array<{ id: string; label: string; category: string }>;
}

export function SearchPalette() {
  const { setActiveSection, setSelectedGame, searchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState("");

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen, setSearchOpen]);

  const { data } = useQuery<SearchResult>({
    queryKey: ["search", query],
    queryFn: async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const j = await r.json();
      return j.data;
    },
    enabled: query.length >= 1,
  });

  const navigate = useCallback((section: string) => {
    setActiveSection(section);
    setSearchOpen(false);
    setQuery("");
  }, [setActiveSection, setSearchOpen]);

  const playGame = useCallback((slug: string) => {
    setSelectedGame(slug);
    setSearchOpen(false);
    setQuery("");
  }, [setSelectedGame, setSearchOpen]);

  const results = data || { games: [], tournaments: [], players: [], sections: [] };
  const hasResults = results.games.length > 0 || results.tournaments.length > 0 || results.players.length > 0 || results.sections.length > 0;

  return (
    <>
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Search games, tournaments, players, or navigate…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          {query.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p>Start typing to search across the platform</p>
              <p className="mt-1 text-[10px]">Games · Tournaments · Players · Navigation</p>
            </div>
          ) : !hasResults ? (
            <CommandEmpty>No results found for "{query}".</CommandEmpty>
          ) : (
            <>
              {results.sections.length > 0 && (
                <CommandGroup heading="Navigate">
                  {results.sections.map((s) => (
                    <CommandItem key={s.id} onSelect={() => navigate(s.id)} className="cursor-pointer">
                      <Navigation className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{s.label}</span>
                      <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results.games.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Games">
                    {results.games.map((g) => (
                      <CommandItem key={g.id} onSelect={() => playGame(g.slug)} className="cursor-pointer">
                        {g.category === "originals" ? (
                          <Dices className="mr-2 h-4 w-4" style={{ color: "var(--color-lime)" }} />
                        ) : (
                          <Gamepad2 className="mr-2 h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{g.name}</div>
                          <div className="text-[10px] text-muted-foreground">{g.provider} · {g.category} · {g.rtp}% RTP</div>
                        </div>
                        {g.category === "originals" && (
                          <span className="rounded bg-lime/10 px-1 text-[9px] font-bold uppercase text-lime" style={{ background: "color-mix(in oklab, var(--color-lime) 10%, transparent)", color: "var(--color-lime)" }}>Play</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results.tournaments.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Tournaments">
                    {results.tournaments.map((t) => (
                      <CommandItem key={t.id} onSelect={() => navigate("tournaments")} className="cursor-pointer">
                        <Trophy className="mr-2 h-4 w-4" style={{ color: t.bannerColor }} />
                        <div className="flex-1">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-[10px] text-muted-foreground">{formatCurrency(t.prizePool)} prize pool · {t.status}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results.players.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Players">
                    {results.players.map((p) => (
                      <CommandItem key={p.id} onSelect={() => navigate("leaderboard")} className="cursor-pointer">
                        <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold" style={{ background: p.avatarColor, color: "var(--color-bg)" }}>
                          {p.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{p.username}</span>
                        <span className="ml-1 text-[10px] text-muted-foreground">Lvl {p.level}</span>
                        <Users className="ml-auto h-3 w-3 text-muted-foreground" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

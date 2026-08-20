"use client";

// Header search — debounced, with a suggestions dropdown (thumbnail, name,
// category, provider) and full keyboard navigation. Fast search: min 2 chars,
// ~250ms debounce, Enter/arrows to pick, Esc to dismiss, click-through to the game.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, CornerDownLeft } from "lucide-react";
import type { LobbyGame } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 8;

function categoryLabel(category: string, gameType: string): string {
  if (gameType === "original") return "Original";
  if (gameType === "external_slot") return "Slot";
  if (gameType === "external_virtual") return "Virtual";
  return category.replace(/[_-]/g, " ") || "Game";
}

export function SearchBar({ games, onGameClick, className = "" }: {
  games: LobbyGame[];
  onGameClick: (game: LobbyGame) => void;
  className?: string;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the query before running the (potentially large) filter.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (q.length < MIN_CHARS) return [];
    return games
      .filter((g) => g.name.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [debounced, games]);

  const show = open && debounced.trim().length >= MIN_CHARS;

  const select = (game: LobbyGame) => {
    setOpen(false);
    setQuery("");
    setDebounced("");
    onGameClick(game);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!show) {
      if (e.key === "Enter" && results[0]) { e.preventDefault(); select(results[0]); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[activeIndex]) select(results[activeIndex]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="h-9 w-full rounded-lg border border-white/8 bg-white/[.035] pl-8 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-lime/35"
        />
        {query.length >= MIN_CHARS && query !== debounced && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white/30" />
        )}
      </div>

      {show && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border/60 bg-surface shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {t("search.noResults")}
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((game, i) => (
                <li key={game.id || game.slug}>
                  <button
                    onClick={() => select(game)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${i === activeIndex ? "bg-secondary/60" : "hover:bg-secondary/40"}`}
                  >
                    <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md bg-secondary/60">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={game.thumbnailUrl || game.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{game.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {categoryLabel(game.category, game.gameType)} · {game.provider}
                      </p>
                    </div>
                    {game.isLive && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-win" />}
                    {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-lime/60" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

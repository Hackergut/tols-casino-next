"use client";

import { useEffect, useState } from "react";
import { Rocket, Trophy, Layers, Gamepad2, Sparkles, type LucideIcon } from "lucide-react";
import { Carousel } from "./Carousel";
import { LobbyGameCard } from "./GameCards";
import type { LobbyGame } from "./lobby-types";

/*
 * EuroVirtuals catalogue for the home lobby, fetched live from
 * /api/eurovirtuals/games (their /v1/games, 5-min server cache) and split into
 * one row PER CATEGORY (Crash Games, Virtual Sport, Slots, Arcade, Jackpot…)
 * instead of a single undifferentiated "Virtual Sports" row. Clicks go through
 * the same onSelect → gameType "external_virtual" → VirtualGameModal launcher.
 */
interface EvApiGame {
  game_uuid: string;
  game_name: string;
  thumbnail: string;
  category: string;
  provider: string;
}

function toLobbyGame(g: EvApiGame): LobbyGame {
  return {
    id: g.game_uuid,
    slug: g.game_uuid,
    name: g.game_name,
    provider: g.provider || "EuroVirtuals",
    category: g.category || "Virtual",
    imageUrl: g.thumbnail,
    thumbnailUrl: g.thumbnail,
    rtp: null,
    volatility: null,
    isLive: false,
    isNew: false,
    featured: false,
    description: null,
    gameType: "external_virtual",
    popularity: 0,
  };
}

// Preferred display order + icon per vendor category. Anything unmatched falls
// through after these, alphabetically, with a default icon.
const CATEGORY_META: { match: string; label: string; icon: LucideIcon }[] = [
  { match: "crash", label: "Crash Games", icon: Rocket },
  { match: "virtual", label: "Virtual Sport", icon: Trophy },
  { match: "slot", label: "Slots", icon: Layers },
  { match: "arcade", label: "Arcade", icon: Gamepad2 },
  { match: "jackpot", label: "Jackpot Games", icon: Sparkles },
];

function metaFor(category: string): { label: string; icon: LucideIcon } {
  const c = category.toLowerCase();
  const found = CATEGORY_META.find((m) => c.includes(m.match));
  return found ? { label: found.label, icon: found.icon } : { label: category, icon: Gamepad2 };
}

function orderIndex(category: string): number {
  const c = category.toLowerCase();
  const i = CATEGORY_META.findIndex((m) => c.includes(m.match));
  return i === -1 ? CATEGORY_META.length : i;
}

export function EurovirtualsRow({ onSelect }: { onSelect: (game: LobbyGame) => void }) {
  const [games, setGames] = useState<LobbyGame[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/eurovirtuals/games")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setGames(j.success ? (j.data as EvApiGame[]).map(toLobbyGame) : []); })
      .catch(() => { if (!cancelled) setGames([]); });
    return () => { cancelled = true; };
  }, []);

  // Not configured or empty catalogue: render nothing rather than a dead row.
  if (games === null || games.length === 0) return null;

  // Group by vendor category.
  const groups = new Map<string, LobbyGame[]>();
  for (const g of games) {
    const key = g.category || "Virtual";
    const arr = groups.get(key) ?? [];
    arr.push(g);
    groups.set(key, arr);
  }

  const orderedCats = [...groups.keys()].sort((a, b) => {
    const d = orderIndex(a) - orderIndex(b);
    return d !== 0 ? d : a.localeCompare(b);
  });

  return (
    <>
      {orderedCats.map((cat) => {
        const { label, icon: Icon } = metaFor(cat);
        const list = groups.get(cat)!;
        return (
          <Carousel key={cat} title={label} size="large" icon={<Icon className="h-5 w-5 shrink-0 text-lime" />}>
            {list.map((g) => <LobbyGameCard key={g.id} game={g} onClick={() => onSelect(g)} />)}
          </Carousel>
        );
      })}
    </>
  );
}

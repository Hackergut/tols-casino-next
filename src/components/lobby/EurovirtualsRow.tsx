"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { Carousel } from "./Carousel";
import { LobbyGameCard } from "./GameCards";
import type { LobbyGame } from "./lobby-types";

/*
 * "Virtual Sports" row for the home lobby — EuroVirtuals' catalogue, fetched
 * live from /api/eurovirtuals/games (their /v1/games, 5-min server cache).
 * Mapped into the shared LobbyGame shape so it renders with the same
 * LobbyGameCard as every other row, and a click goes through the same
 * onGameClick → gameType "external_virtual" → VirtualGameModal path used by
 * the "Virtuali" tab in LobbyView — one launcher, not a second one.
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
    category: g.category || "virtual",
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

  return (
    <Carousel title="Virtual Sports" size="large" icon={<Rocket className="h-5 w-5 shrink-0 text-lime" />}>
      {games.map((g) => <LobbyGameCard key={g.id} game={g} onClick={() => onSelect(g)} />)}
    </Carousel>
  );
}

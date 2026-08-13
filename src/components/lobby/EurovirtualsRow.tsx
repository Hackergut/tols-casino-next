"use client";

import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { Carousel } from "./Carousel";

/*
 * "Virtual Sports" row — EuroVirtuals' catalogue, fetched live from
 * /api/eurovirtuals/games (their /v1/games, cached 5 min server-side). A
 * separate card from LobbyGameCard because the shape differs (thumbnail vs.
 * imageUrl, no RTP/slug) and clicking one opens the EuroVirtuals iframe
 * launcher rather than an Originals game.
 */
export interface EvGame {
  game_uuid: string;
  game_name: string;
  thumbnail: string;
  category: string;
  provider: string;
}

export function EurovirtualsRow({ onSelect }: { onSelect: (game: EvGame) => void }) {
  const [games, setGames] = useState<EvGame[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/eurovirtuals/games")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.success) setGames(j.data); else if (!cancelled) setGames([]); })
      .catch(() => { if (!cancelled) setGames([]); });
    return () => { cancelled = true; };
  }, []);

  // Not configured or empty catalogue: render nothing rather than a dead row.
  if (games === null || games.length === 0) return null;

  return (
    <Carousel title="Virtual Sports" size="large" icon={<Rocket className="h-5 w-5 shrink-0 text-lime" />}>
      {games.map((g) => (
        <button
          key={g.game_uuid}
          onClick={() => onSelect(g)}
          className="group relative block aspect-[16/11] w-full overflow-hidden rounded-2xl border border-white/6 bg-surface text-left transition-transform hover:-translate-y-0.5"
        >
          <img
            src={g.thumbnail}
            alt={g.game_name}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <span className="absolute left-2.5 top-2.5 rounded-full border border-lime/50 bg-black/60 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-lime backdrop-blur-sm">
            {g.provider}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate font-bold text-white" style={{ fontSize: "clamp(0.875rem, 0.78rem + 0.42vw, 1.0625rem)" }}>{g.game_name}</p>
            <p className="truncate text-white/60" style={{ fontSize: "clamp(0.75rem, 0.7rem + 0.24vw, 0.875rem)" }}>{g.category}</p>
          </div>
        </button>
      ))}
    </Carousel>
  );
}

"use client";

// Virtual Games tab — EuroVirtuals catalog rendered as LobbyGameCards.
// Fetches /api/games-lobby?vendor=eurovirtuals. Empty state mirrors LobbyView's.

import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { GamesShelfGrid, LobbyGameCard } from "./GameCards";
import { GamesGridSkeleton, EmptyGames } from "./LobbyView";
import type { LobbyGame } from "./lobby-types";

export function VirtualGamesView({
  onGameSelect,
}: {
  onGameSelect: (game: LobbyGame) => void;
}) {
  const [games, setGames] = useState<LobbyGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Standard "fetch on mount" pattern: set loading then start the request.
    // Lint is wrong here — there's no cascade; this is the documented use of
    // a one-shot effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/games-lobby?vendor=eurovirtuals")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok || !j?.success) {
          setError(j?.error || "Failed to load virtual games");
          setGames([]);
          return;
        }
        const list: LobbyGame[] = (j.data || []).map((g: Record<string, unknown>) => ({
          id: String(g.id),
          slug: String(g.slug ?? g.id),
          name: String(g.name),
          provider: String(g.provider),
          category: String(g.category ?? "virtual"),
          imageUrl: String(g.imageUrl ?? ""),
          thumbnailUrl: String(g.thumbnailUrl ?? g.imageUrl ?? ""),
          rtp: g.rtp != null ? Number(g.rtp) : null,
          volatility: g.volatility != null ? String(g.volatility) : null,
          isLive: Boolean(g.isLive),
          isNew: Boolean(g.isNew),
          featured: Boolean(g.featured),
          description: g.description != null ? String(g.description) : null,
          gameType: "external_virtual",
          popularity: Number(g.popularity ?? 0),
        }));
        setGames(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Network error");
        setGames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-lime" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            EuroVirtuals · Caricamento…
          </h3>
        </div>
        <GamesGridSkeleton />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-lime" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            EuroVirtuals
          </h3>
        </div>
        <EmptyGames label={error} />
      </section>
    );
  }

  if (games.length === 0) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-lime" />
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            EuroVirtuals
          </h3>
        </div>
        <EmptyGames label="Nessun gioco virtuale disponibile" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-4 w-4 text-lime" />
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
          EuroVirtuals · {games.length} giochi
        </h3>
      </div>
      <GamesShelfGrid>
        {games.map((g) => (
          <LobbyGameCard key={g.id} game={g} onClick={() => onGameSelect(g)} />
        ))}
      </GamesShelfGrid>
    </section>
  );
}

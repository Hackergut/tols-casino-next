"use client";

// Virtual Games tab — EuroVirtuals catalog rendered as LobbyGameCards.
// Fetches /api/eurovirtuals/games — EuroVirtuals' live /v1/games catalogue
// (5-min server cache), NOT a local table: no CasinoGame rows are ever seeded
// for this vendor, so /api/games-lobby?vendor=eurovirtuals would stay empty.
// Empty state mirrors LobbyView's.

import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { LobbyGameCard } from "./GameCards";
import { GamesGridSkeleton, EmptyGames } from "./LobbyView";
import type { LobbyGame } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

export function VirtualGamesView({
  onGameSelect,
}: {
  onGameSelect: (game: LobbyGame) => void;
}) {
  const { t } = useLocale();
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
    fetch("/api/eurovirtuals/games")
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok || !j?.success) {
          setError(j?.error || "Failed to load virtual games");
          setGames([]);
          return;
        }
        const list: LobbyGame[] = (j.data || []).map((g: Record<string, unknown>) => ({
          id: String(g.game_uuid),
          slug: String(g.game_uuid),
          name: String(g.game_name),
          provider: String(g.provider ?? "EuroVirtuals"),
          category: String(g.category ?? "virtual"),
          imageUrl: String(g.thumbnail ?? ""),
          thumbnailUrl: String(g.thumbnail ?? ""),
          rtp: null,
          volatility: null,
          isLive: false,
          isNew: false,
          featured: false,
          description: null,
          gameType: "external_virtual",
          popularity: 0,
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
        <EmptyGames label={t("games.none")} />
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
      <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
        {games.map((g) => (
          <LobbyGameCard key={g.id} game={g} onClick={() => onGameSelect(g)} />
        ))}
      </div>
    </section>
  );
}

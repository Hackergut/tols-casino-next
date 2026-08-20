"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { LobbyGameCard, GamesShelfGrid } from "./GameCards";
import { Carousel } from "./Carousel";
import { ORIGINAL_GAMES, originalToLobbyGame } from "./lobby-types";

export function OriginalsView({ onGameSelect }: { onGameSelect: (gameId: string) => void }) {
  const [gridMode, setGridMode] = useState(false);
  const games = ORIGINAL_GAMES.map(originalToLobbyGame);

  const toggle = (
    <button
      type="button"
      onClick={() => setGridMode((g) => !g)}
      className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-lime/30 hover:text-white"
    >
      {gridMode ? "Carousel" : "View all"}
    </button>
  );

  const cards = games.map((game) => (
    <LobbyGameCard key={game.id} game={game} onClick={() => onGameSelect(game.id)} />
  ));

  return (
    <div className="space-y-6">
      {gridMode ? (
        <section>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 shrink-0 text-lime" />
                <h2 className="font-display truncate text-base uppercase text-white">TOLS Originals</h2>
              </div>
              <p className="mt-1 text-xs text-white/40">Provably fair · HMAC-SHA256 · Auto Bet on every title</p>
            </div>
            {toggle}
          </header>
          <GamesShelfGrid>{cards}</GamesShelfGrid>
        </section>
      ) : (
        <Carousel
          title="TOLS Originals"
          subtitle="Provably fair · HMAC-SHA256 · Auto Bet on every title"
          size="large"
          icon={<Flame className="h-5 w-5 shrink-0 text-lime" />}
          action={toggle}
        >
          {cards}
        </Carousel>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Gamepad2 } from "lucide-react";
import { OriginalGameCard } from "./GameCards";
import { Carousel } from "./Carousel";
import { ORIGINAL_GAMES } from "./lobby-types";
import { useLocale } from "@/lib/use-locale";

export function OriginalsView({ onGameSelect, query = "" }: { onGameSelect: (gameId: string) => void; query?: string }) {
  const [gridMode, setGridMode] = useState(false);
  const { t } = useLocale();
  const games = query.trim()
    ? ORIGINAL_GAMES.filter((game) => `${game.name} ${game.desc}`.toLowerCase().includes(query.trim().toLowerCase()))
    : ORIGINAL_GAMES;

  const toggle = (
    <button
      onClick={() => setGridMode((g) => !g)}
      className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white"
    >
      {gridMode ? t("common.carousel") : t("common.viewAll")}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Original Games</h2>
        <p className="mt-1 text-sm text-muted-foreground">Provably fair games with verifiable outcomes</p>
      </div>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center text-sm text-white/40">{t("games.none")}</div>
      ) : gridMode ? (
        <section>
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-lime" />
              <h2 className="text-lg font-black uppercase tracking-wide text-white">TOLS Originals</h2>
            </div>
            {toggle}
          </header>
          <div className="casino-game-grid grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
            {games.map((game) => (
              <OriginalGameCard key={game.id} game={game} onClick={() => onGameSelect(game.id)} />
            ))}
          </div>
        </section>
      ) : (
        <Carousel
          title="TOLS Originals"
          size="large"
          icon={<Gamepad2 className="h-5 w-5 shrink-0 text-lime" />}
          action={toggle}
        >
          {games.map((game) => (
            <OriginalGameCard key={game.id} game={game} onClick={() => onGameSelect(game.id)} />
          ))}
        </Carousel>
      )}
    </div>
  );
}

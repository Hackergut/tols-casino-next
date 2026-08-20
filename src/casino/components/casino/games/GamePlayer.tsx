"use client";

import type { ComponentType } from "react";
import { useSessionStore, useUIStore } from "@/lib/store";
import { OriginalsRail } from "@/components/casino/OriginalsRail";
import { originalArtUrl } from "@/components/lobby/lobby-types";
import { CrashGame } from "@/components/casino/game-crash";
import { DiceGame } from "@/components/casino/game-dice";
import { MinesGame } from "@/components/casino/game-mines";
import { WheelGame } from "@/components/casino/game-wheel";
import { KenoGame } from "@/components/casino/game-keno";
import { LimboGame } from "@/components/casino/game-limbo";
import { PlinkoGame } from "@/components/casino/game-plinko";
import { CoinflipGame } from "@/components/casino/game-coinflip";
import { ShootGame } from "@/components/casino/game-shoot";
import { SlotsGame } from "@/components/casino/game-slots";
import { RouletteGame } from "@/components/casino/game-roulette";
import { BlackjackGame } from "@/components/casino/game-blackjack";
import { PoolRushGame } from "@/components/casino/game-poolrush";
import { ScopaGame } from "@/components/casino/game-scopa";
import type { OriginalId } from "@/lib/originals-registry";

const GAMES: Record<string, ComponentType<{ onBack: () => void; initialBalance: number; onPickGame?: (id: OriginalId) => void }>> = {
  crash: CrashGame,
  dice: DiceGame,
  mines: MinesGame,
  wheel: WheelGame,
  keno: KenoGame,
  limbo: LimboGame,
  plinko: PlinkoGame,
  coinflip: CoinflipGame,
  shoot: ShootGame,
  slots: SlotsGame,
  roulette: RouletteGame,
  blackjack: BlackjackGame,
  "pool-rush": PoolRushGame,
  scopa: ScopaGame,
};

export function GamePlayer({ slug }: { slug: string }) {
  const balance = useSessionStore((s) => s.balance);
  const setSelectedGame = useUIStore((s) => s.setSelectedGame);
  const Game = GAMES[slug];

  if (!Game) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/40 p-8 text-center text-muted-foreground">
        <p className="text-sm uppercase tracking-wider">Unknown game</p>
        <p className="mt-1 font-mono text-xs">{slug}</p>
      </div>
    );
  }

  return (
    <div className="originals-stage">
      <Game
        onBack={() => setSelectedGame(null)}
        initialBalance={balance}
        onPickGame={(id) => setSelectedGame(id)}
      />
      <OriginalsRail gameId={slug} />
    </div>
  );
}

export default GamePlayer;

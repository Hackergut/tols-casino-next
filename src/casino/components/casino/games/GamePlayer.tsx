"use client";

/*
 * Admin preview adapter — no game logic lives here anymore.
 *
 * This file used to carry a full, older copy of seven Originals: its own
 * fetch layer, its own sound ceremony, and — because copies drift — the exact
 * bugs the shared games have already fixed:
 *
 *   - Dice quoted `Math.max(1.01, 99 / chance)` — a 1%-edge formula, while the
 *     server pays from the 6% house edge. The admin preview promised payouts
 *     the wallet never delivered.
 *   - Plinko and Wheel rendered hardcoded tables (the 251% / 64% RTP ones)
 *     that the server stopped paying.
 *   - The balance was hand-synced through a second store, so it could disagree
 *     with the wallet the player actually has.
 *   - Crash/Mines kept the double-charge flows here long after the shared
 *     games fixed them.
 *
 * The real games live in src/components/casino/game-*.tsx behind GameFrame.
 * This adapter just maps a lobby slug to that implementation so the admin
 * preview shows exactly what players see — one implementation, one place to
 * fix.
 */

import React from "react";
import { useSessionStore, useUIStore } from "@/casino/lib/store";
import type { OriginalId } from "@/lib/originals-registry";
import { GameFeedback } from "@/components/casino/GameFeedback";
import { DiceGame } from "@/components/casino/game-dice";
import { CrashGame } from "@/components/casino/game-crash";
import { PlinkoGame } from "@/components/casino/game-plinko";
import { MinesGame } from "@/components/casino/game-mines";
import { LimboGame } from "@/components/casino/game-limbo";
import { CoinflipGame } from "@/components/casino/game-coinflip";
import { WheelGame } from "@/components/casino/game-wheel";
import { KenoGame } from "@/components/casino/game-keno";
import { ShootGame } from "@/components/casino/game-shoot";
import { SlotsGame } from "@/components/casino/game-slots";
import { RouletteGame } from "@/components/casino/game-roulette";
import { PoolRushGame } from "@/components/casino/game-poolrush";

interface GameProps {
  onBack: () => void;
  initialBalance: number;
  onPickGame?: (id: OriginalId) => void;
}

/** Every Original, keyed by the lobby slug. */
const GAMES: Record<OriginalId, React.ComponentType<GameProps>> = {
  dice: DiceGame,
  crash: CrashGame,
  plinko: PlinkoGame,
  mines: MinesGame,
  limbo: LimboGame,
  coinflip: CoinflipGame,
  wheel: WheelGame,
  keno: KenoGame,
  shoot: ShootGame,
  slots: SlotsGame,
  roulette: RouletteGame,
  poolrush: PoolRushGame,
};

export function GamePlayer({ slug }: { slug: string }) {
  // Seed only: once a bet settles, useBet keeps the wallet-authoritative
  // balance from the server response.
  const balance = useSessionStore((s) => s.balance);
  const setSelectedGame = useUIStore((s) => s.setSelectedGame);

  const Game = (GAMES as Record<string, React.ComponentType<GameProps> | undefined>)[slug];
  if (!Game) {
    return (
      <div className="p-8 text-center text-muted-foreground rounded-lg bg-card/40 border border-border/50">
        <p className="uppercase tracking-wider text-sm">Unknown game</p>
        <p className="font-mono text-xs mt-1">{slug}</p>
      </div>
    );
  }

  return (
    <>
      <Game
        onBack={() => setSelectedGame(null)}
        initialBalance={balance}
        onPickGame={(id) => setSelectedGame(id)}
      />
      {/* Audio cue + rejected-bet toasts, same as the player-facing app. */}
      <GameFeedback />
    </>
  );
}

export default GamePlayer;

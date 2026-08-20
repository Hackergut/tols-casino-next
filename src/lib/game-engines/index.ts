import type { GameEngine, OriginalGameId } from "@/shared/types";
import {
  coinflipEngine,
  diceEngine,
  kenoEngine,
  limboEngine,
  plinkoEngine,
  poolRushEngine,
  rouletteEngine,
  shootEngine,
  slotsEngine,
  wheelEngine,
} from "./instant";
import { blackjackEngine, crashEngine, minesEngine } from "./interactive";
import { scopaEngine } from "./scopa";

const ENGINES: Record<OriginalGameId, GameEngine> = {
  dice: diceEngine,
  limbo: limboEngine,
  crash: crashEngine,
  plinko: plinkoEngine,
  mines: minesEngine,
  coinflip: coinflipEngine,
  wheel: wheelEngine,
  keno: kenoEngine,
  shoot: shootEngine,
  slots: slotsEngine,
  roulette: rouletteEngine,
  blackjack: blackjackEngine,
  "pool-rush": poolRushEngine,
  scopa: scopaEngine,
};

export function getEngine(id: string): GameEngine | null {
  return (ENGINES as Record<string, GameEngine>)[id] ?? null;
}

export function listEngines(): GameEngine[] {
  return Object.values(ENGINES);
}

export { blackjackEngine, crashEngine, minesEngine, poolRushEngine, scopaEngine };
export { bjHandValue } from "./interactive";
export type { BjCard } from "./interactive";
export type { ScopaCard } from "./scopa";
export { KENO_TABLES, PLINKO_TABLES, POOL_RUSH_PAY, ROULETTE_RED, WHEEL_TABLES } from "./tables";

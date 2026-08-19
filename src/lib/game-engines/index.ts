import type { GameEngine, OriginalGameId } from "@/shared/types";
import {
  coinflipEngine,
  diceEngine,
  kenoEngine,
  limboEngine,
  plinkoEngine,
  rouletteEngine,
  shootEngine,
  slotsEngine,
  wheelEngine,
} from "./instant";
import { blackjackEngine, crashEngine, minesEngine } from "./interactive";

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
};

export function getEngine(id: string): GameEngine | null {
  return (ENGINES as Record<string, GameEngine>)[id] ?? null;
}

export function listEngines(): GameEngine[] {
  return Object.values(ENGINES);
}

export { blackjackEngine, crashEngine, minesEngine };
export { bjHandValue } from "./interactive";
export type { BjCard } from "./interactive";

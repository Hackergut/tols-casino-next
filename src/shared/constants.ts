import type { OriginalGameId } from "./types";

export const MIN_BET = 0.01;
export const MAX_BET = 100_000;

export const GAME_META: Record<
  OriginalGameId,
  { name: string; kind: "instant" | "interactive"; defaultParams: Record<string, unknown> }
> = {
  dice: { name: "Dice", kind: "instant", defaultParams: { target: 50, isOver: false } },
  limbo: { name: "Limbo", kind: "instant", defaultParams: { target: 2 } },
  crash: { name: "Crash", kind: "interactive", defaultParams: { cashOutAt: 2 } },
  plinko: { name: "Plinko", kind: "instant", defaultParams: { risk: "medium", rows: 12 } },
  mines: { name: "Mines", kind: "interactive", defaultParams: { mines: 3, tilesToReveal: 3 } },
  coinflip: { name: "Coinflip", kind: "instant", defaultParams: { choice: "heads" } },
  wheel: { name: "Wheel", kind: "instant", defaultParams: { risk: "medium", segments: 20 } },
  keno: { name: "Keno", kind: "instant", defaultParams: { risk: "classic", picks: [1, 2, 3, 4, 5] } },
  shoot: { name: "Target Shoot", kind: "instant", defaultParams: {} },
  slots: { name: "Slots", kind: "instant", defaultParams: {} },
  roulette: { name: "Roulette", kind: "instant", defaultParams: { bets: [{ type: "red", amount: 0 }] } },
  blackjack: { name: "Blackjack", kind: "interactive", defaultParams: { strategy: "basic" } },
};

export const DEFAULT_AUTO_BET = {
  rounds: 10,
  onWin: "reset" as const,
  onLoss: "reset" as const,
  onWinPercent: 100,
  onLossPercent: 100,
  stopLoss: 0,
  takeProfit: 0,
};

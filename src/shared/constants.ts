import type { OriginalGameId } from "./types";

export const MIN_BET = 0.01;
export const MAX_BET = 100_000;

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const KENO_RISKS = ["classic", "low", "medium", "high"] as const;
export const WHEEL_SEGMENTS = 20;
export const KENO_POOL = 40;
export const KENO_DRAWS = 10;
export const KENO_MAX_PICKS = 10;
export const MINES_TILES = 25;
export const PLINKO_ROWS = [8, 12, 16] as const;

export const GAME_META: Record<
  OriginalGameId,
  { name: string; kind: "instant" | "interactive"; defaultParams: Record<string, unknown> }
> = {
  dice: { name: "Dice", kind: "instant", defaultParams: { target: 50, isOver: true } },
  limbo: { name: "Limbo", kind: "instant", defaultParams: { target: 2 } },
  crash: { name: "Crash", kind: "interactive", defaultParams: { cashOutAt: 2 } },
  plinko: { name: "Plinko", kind: "instant", defaultParams: { risk: "medium", rows: 12 } },
  mines: { name: "Mines", kind: "interactive", defaultParams: { mines: 3, tilesToReveal: 3 } },
  coinflip: { name: "Coinflip", kind: "instant", defaultParams: { choice: "heads" } },
  wheel: { name: "Wheel", kind: "instant", defaultParams: { risk: "medium", segments: WHEEL_SEGMENTS } },
  keno: { name: "Keno", kind: "instant", defaultParams: { risk: "classic", picks: [1, 2, 3, 4, 5] } },
  shoot: { name: "Target Shoot", kind: "instant", defaultParams: { target: 2 } },
  slots: { name: "Slots", kind: "instant", defaultParams: {} },
  roulette: { name: "Roulette", kind: "instant", defaultParams: { color: "red" } },
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

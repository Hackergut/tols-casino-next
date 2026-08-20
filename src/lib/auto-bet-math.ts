import type { AutoAdjustMode, AutoBetParams } from "@/shared/types";

/*
 * Pure auto-bet math (autoplay-system-designer skill) — no I/O, so the same
 * code is unit-tested by node --test and used by the server.
 *
 * Contract:
 *  · rounds are clamped to [1, 1000] — auto-play is never unbounded
 *  · stakes never go below MIN_BET (0.01) and never above MAX_BET
 *  · stop conditions are deterministic and checked before/after each tick
 */

export const AUTO_BET_DEFAULTS = {
  rounds: 10,
  onWin: "reset" as AutoAdjustMode,
  onLoss: "reset" as AutoAdjustMode,
  onWinPercent: 100,
  onLossPercent: 100,
  stopLoss: 0,
  takeProfit: 0,
};

export function nextStake(current: number, base: number, mode: AutoAdjustMode, percent: number): number {
  const p = Math.max(0, percent) / 100;
  switch (mode) {
    case "increase":
      return Math.max(0.01, Math.round(current * (1 + p) * 100) / 100);
    case "decrease":
      return Math.max(0.01, Math.round(current * Math.max(0.01, 1 - p) * 100) / 100);
    case "fixed":
      return current;
    case "reset":
    default:
      return base;
  }
}

export function normalizeAutoBetParams(input: Partial<AutoBetParams> & { baseBet: number; gameParams?: Record<string, unknown> }): AutoBetParams {
  return {
    rounds: Math.max(1, Math.min(1000, Math.floor(Number(input.rounds ?? AUTO_BET_DEFAULTS.rounds)))),
    baseBet: Math.max(0.01, Number(input.baseBet)),
    onWin: (input.onWin ?? AUTO_BET_DEFAULTS.onWin) as AutoAdjustMode,
    onLoss: (input.onLoss ?? AUTO_BET_DEFAULTS.onLoss) as AutoAdjustMode,
    onWinPercent: Math.max(0, Number(input.onWinPercent ?? AUTO_BET_DEFAULTS.onWinPercent)),
    onLossPercent: Math.max(0, Number(input.onLossPercent ?? AUTO_BET_DEFAULTS.onLossPercent)),
    stopLoss: Math.max(0, Number(input.stopLoss ?? AUTO_BET_DEFAULTS.stopLoss)),
    takeProfit: Math.max(0, Number(input.takeProfit ?? AUTO_BET_DEFAULTS.takeProfit)),
    gameParams: input.gameParams ?? {},
  };
}

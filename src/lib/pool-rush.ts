/*
 * Pool Rush — fixed 96% RTP across four volatility profiles.
 *
 * Probabilities are the server truth and sum to exactly one per level. The
 * first row is always the miss band; difficulty changes hit frequency and tail
 * size, never the theoretical return.
 */

export const POOL_RUSH_RTP = 0.96;
export const POOL_RUSH_MIN_BET = 0.1;
export const POOL_RUSH_MAX_BET = 100;
export const POOL_RUSH_LEVELS = ["beginner", "intermediate", "expert", "pro"] as const;
export type PoolRushLevel = (typeof POOL_RUSH_LEVELS)[number];

export interface PoolRushBand {
  balls: number;
  multiplier: number;
  probability: number;
}

export interface PoolRushLevelConfig {
  label: string;
  shot: string;
  power: number;
  volatility: "low" | "medium" | "high" | "very-high";
  accent: string;
  animationMs: number;
  cueEffect: number;
  bands: readonly PoolRushBand[];
}

export const POOL_RUSH_CONFIG: Record<PoolRushLevel, PoolRushLevelConfig> = {
  beginner: {
    label: "Beginner", shot: "Centre shot", power: 35, volatility: "low", accent: "#35d07f", animationMs: 1300, cueEffect: 0,
    bands: [
      { balls: 0, multiplier: 0, probability: 0.5 },
      { balls: 1, multiplier: 1, probability: 0.276 },
      { balls: 2, multiplier: 2, probability: 0.104 },
      { balls: 3, multiplier: 3, probability: 0.065 },
      { balls: 4, multiplier: 4, probability: 0.03 },
      { balls: 5, multiplier: 5, probability: 0.015 },
      { balls: 6, multiplier: 8, probability: 0.007 },
      { balls: 7, multiplier: 10, probability: 0.003 },
    ],
  },
  intermediate: {
    label: "Intermediate", shot: "Full hit", power: 55, volatility: "medium", accent: "#f4c84a", animationMs: 1450, cueEffect: 1.5,
    bands: [
      { balls: 0, multiplier: 0, probability: 0.65 },
      { balls: 1, multiplier: 1, probability: 0.15 },
      { balls: 2, multiplier: 2, probability: 0.09 },
      { balls: 3, multiplier: 3, probability: 0.055 },
      { balls: 4, multiplier: 5, probability: 0.03 },
      { balls: 5, multiplier: 8, probability: 0.015 },
      { balls: 6, multiplier: 15, probability: 0.007 },
      { balls: 7, multiplier: 30, probability: 0.003 },
    ],
  },
  expert: {
    label: "Expert", shot: "Power draw", power: 78, volatility: "high", accent: "#ff5d62", animationMs: 1650, cueEffect: -3,
    bands: [
      { balls: 0, multiplier: 0, probability: 0.75 },
      { balls: 1, multiplier: 1, probability: 0.12064646464646465 },
      { balls: 2, multiplier: 2, probability: 0.06 },
      { balls: 3, multiplier: 4, probability: 0.035 },
      { balls: 4, multiplier: 8, probability: 0.018 },
      { balls: 5, multiplier: 15, probability: 0.01 },
      { balls: 6, multiplier: 30, probability: 0.005 },
      { balls: 7, multiplier: 100, probability: 0.00135353535353535 },
    ],
  },
  pro: {
    label: "Pro", shot: "Jump break", power: 100, volatility: "very-high", accent: "#b26cff", animationMs: 1800, cueEffect: 5,
    bands: [
      { balls: 0, multiplier: 0, probability: 0.85 },
      { balls: 1, multiplier: 1, probability: 0.09018436873747495 },
      { balls: 2, multiplier: 3, probability: 0.035 },
      { balls: 3, multiplier: 8, probability: 0.014 },
      { balls: 4, multiplier: 20, probability: 0.006 },
      { balls: 5, multiplier: 50, probability: 0.003 },
      { balls: 6, multiplier: 150, probability: 0.0015 },
      { balls: 7, multiplier: 500, probability: 0.00031563126252505 },
    ],
  },
};

export function isPoolRushLevel(value: unknown): value is PoolRushLevel {
  return typeof value === "string" && POOL_RUSH_LEVELS.includes(value as PoolRushLevel);
}

export function poolRushOutcome(uniform: number, level: PoolRushLevel): PoolRushBand {
  const bands = POOL_RUSH_CONFIG[level].bands;
  const roll = Math.min(1 - Number.EPSILON, Math.max(0, uniform));
  let cumulative = 0;
  for (const band of bands) {
    cumulative += band.probability;
    if (roll < cumulative) return band;
  }
  return bands[bands.length - 1];
}

export function poolRushRtp(level: PoolRushLevel): number {
  return POOL_RUSH_CONFIG[level].bands.reduce(
    (sum, band) => sum + band.probability * band.multiplier,
    0,
  );
}

export function poolRushHitFrequency(level: PoolRushLevel): number {
  return 1 - POOL_RUSH_CONFIG[level].bands[0].probability;
}

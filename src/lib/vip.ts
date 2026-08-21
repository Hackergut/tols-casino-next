/*
 * TOLS VIP ladder — single source of truth for the client (VIP page) and the
 * server (auto-promotion on every bet, reward eligibility).
 *
 * Casino wagers earn 1 XP per $1 USD. Crossing a rank's XP threshold updates
 * `CasinoWallet.vipLevel` everywhere (header, VIP page, admin).
 *
 * 54 ranks from Seed → Eternal. Below Seed the player is unranked ("Player").
 */

export type VipFamily =
  | "player"
  | "seed"
  | "copper"
  | "iron"
  | "amber"
  | "titanium"
  | "emerald"
  | "cobalt"
  | "garnet"
  | "onyx"
  | "pearl"
  | "serpent"
  | "celestial"
  | "void"
  | "eternal";

export interface VipTier {
  level: number;
  name: string;
  family: VipFamily;
  color: string;
  /** Cumulative XP required. Alias of `points` so older callers keep working. */
  xp: number;
  points: number;
  rakeback: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  host: boolean;
  /** Fixed panel bonus paid on the VIP page when this rank is reached. */
  rankUpBonus: number;
  benefits: string[];
}

interface FamilySpec {
  color: string;
  rakeback: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  host: boolean;
  benefits: string[];
}

const FAMILY: Record<Exclude<VipFamily, "player">, FamilySpec> = {
  seed:      { color: "#a3e635", rakeback: 0.5,  dailyRate: 0,   weeklyRate: 0,   monthlyRate: 0.5,  host: false, benefits: ["Rakeback on every casino wager", "Monthly bonus"] },
  copper:    { color: "#d97706", rakeback: 1,    dailyRate: 0.4, weeklyRate: 0,   monthlyRate: 0.8,  host: false, benefits: ["Daily bonus at 00:00 UTC", "Rakeback", "Monthly bonus"] },
  iron:      { color: "#94a3b8", rakeback: 1.5,  dailyRate: 0.6, weeklyRate: 1.0, monthlyRate: 1.2,  host: false, benefits: ["Daily bonus", "Weekly bonus (Thursday 11:00 UTC)", "Rakeback", "Monthly bonus"] },
  amber:     { color: "#f59e0b", rakeback: 2,    dailyRate: 0.8, weeklyRate: 1.2, monthlyRate: 1.5,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads on rank-up"] },
  titanium:  { color: "#cbd5e1", rakeback: 2.5,  dailyRate: 1.0, weeklyRate: 1.5, monthlyRate: 2.0,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  emerald:   { color: "#34d399", rakeback: 3,    dailyRate: 1.2, weeklyRate: 2.0, monthlyRate: 2.5,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  cobalt:    { color: "#38bdf8", rakeback: 4,    dailyRate: 1.5, weeklyRate: 2.5, monthlyRate: 3.0,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  garnet:    { color: "#fb7185", rakeback: 5,    dailyRate: 2.0, weeklyRate: 3.0, monthlyRate: 4.0,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  onyx:      { color: "#64748b", rakeback: 6,    dailyRate: 2.5, weeklyRate: 3.5, monthlyRate: 5.0,  host: false, benefits: ["Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  pearl:     { color: "#e2e8f0", rakeback: 8,    dailyRate: 3.0, weeklyRate: 4.5, monthlyRate: 6.0,  host: true,  benefits: ["VIP Host", "Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  serpent:   { color: "#4ade80", rakeback: 10,   dailyRate: 3.5, weeklyRate: 5.5, monthlyRate: 8.0,  host: true,  benefits: ["VIP Host", "Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus", "Reloads"] },
  celestial: { color: "#c4b5fd", rakeback: 12,   dailyRate: 4.0, weeklyRate: 7.0, monthlyRate: 10.0, host: true,  benefits: ["Dedicated VIP Host", "Daily bonus", "Weekly bonus", "Rakeback", "Monthly bonus"] },
  void:      { color: "#818cf8", rakeback: 15,   dailyRate: 5.0, weeklyRate: 8.0, monthlyRate: 12.0, host: true,  benefits: ["Dedicated VIP Host", "Highest-tier bonuses"] },
  eternal:   { color: "#cdf32b", rakeback: 20,   dailyRate: 6.0, weeklyRate: 10.0, monthlyRate: 15.0, host: true,  benefits: ["Dedicated VIP Host", "Personalised bonuses", "Highest rakeback"] },
};

/** Compact rank table: [name, family, xp, panelBonus]. */
const RANK_ROWS: Array<[string, Exclude<VipFamily, "player">, number, number]> = [
  ["Seed", "seed", 500, 0.9],
  ["Copper 1", "copper", 1_000, 0.9],
  ["Copper 2", "copper", 2_000, 0.9],
  ["Copper 3", "copper", 3_000, 0.9],
  ["Copper 4", "copper", 4_000, 0.9],
  ["Copper 5", "copper", 5_000, 0.9],
  ["Iron 1", "iron", 10_000, 9],
  ["Iron 2", "iron", 20_000, 9],
  ["Iron 3", "iron", 30_000, 9],
  ["Iron 4", "iron", 40_000, 9],
  ["Iron 5", "iron", 50_000, 9],
  ["Amber 1", "amber", 100_000, 80],
  ["Amber 2", "amber", 150_000, 45],
  ["Amber 3", "amber", 200_000, 45],
  ["Amber 4", "amber", 250_000, 45],
  ["Amber 5", "amber", 300_000, 45],
  ["Titanium 1", "titanium", 450_000, 260],
  ["Titanium 2", "titanium", 600_000, 135],
  ["Titanium 3", "titanium", 750_000, 135],
  ["Titanium 4", "titanium", 900_000, 135],
  ["Titanium 5", "titanium", 1_050_000, 135],
  ["Emerald 1", "emerald", 1_200_000, 260],
  ["Emerald 2", "emerald", 1_350_000, 135],
  ["Emerald 3", "emerald", 1_500_000, 135],
  ["Emerald 4", "emerald", 1_650_000, 135],
  ["Emerald 5", "emerald", 1_800_000, 135],
  ["Cobalt 1", "cobalt", 2_300_000, 900],
  ["Cobalt 2", "cobalt", 2_800_000, 450],
  ["Cobalt 3", "cobalt", 3_300_000, 450],
  ["Cobalt 4", "cobalt", 3_800_000, 450],
  ["Cobalt 5", "cobalt", 4_300_000, 450],
  ["Garnet 1", "garnet", 5_800_000, 2_700],
  ["Garnet 2", "garnet", 7_300_000, 1_350],
  ["Garnet 3", "garnet", 8_800_000, 1_350],
  ["Garnet 4", "garnet", 10_300_000, 1_350],
  ["Garnet 5", "garnet", 11_800_000, 1_350],
  ["Onyx 1", "onyx", 17_000_000, 9_360],
  ["Onyx 2", "onyx", 22_000_000, 4_500],
  ["Onyx 3", "onyx", 27_000_000, 4_500],
  ["Onyx 4", "onyx", 32_000_000, 4_500],
  ["Onyx 5", "onyx", 37_000_000, 4_500],
  ["Pearl 1", "pearl", 90_000_000, 0],
  ["Pearl 2", "pearl", 140_000_000, 0],
  ["Pearl 3", "pearl", 190_000_000, 0],
  ["Pearl 4", "pearl", 240_000_000, 0],
  ["Pearl 5", "pearl", 290_000_000, 0],
  ["Serpent 1", "serpent", 340_000_000, 0],
  ["Serpent 2", "serpent", 440_000_000, 0],
  ["Serpent 3", "serpent", 540_000_000, 0],
  ["Serpent 4", "serpent", 640_000_000, 0],
  ["Serpent 5", "serpent", 740_000_000, 0],
  ["Celestial", "celestial", 1_000_000_000, 0],
  ["Void", "void", 5_000_000_000, 0],
  ["Eternal", "eternal", 10_000_000_000, 0],
];

function bump(base: number, indexInFamily: number): number {
  return Math.round((base + indexInFamily * 0.05) * 100) / 100;
}

function buildTiers(): VipTier[] {
  const seen: Partial<Record<VipFamily, number>> = {};
  return RANK_ROWS.map(([name, family, xp, rankUpBonus], i) => {
    const spec = FAMILY[family];
    const idx = seen[family] ?? 0;
    seen[family] = idx + 1;
    return {
      level: i + 1,
      name,
      family,
      color: spec.color,
      xp,
      points: xp,
      rakeback: bump(spec.rakeback, idx),
      dailyRate: spec.dailyRate > 0 ? bump(spec.dailyRate, idx) : 0,
      weeklyRate: spec.weeklyRate > 0 ? bump(spec.weeklyRate, idx) : 0,
      monthlyRate: spec.monthlyRate > 0 ? bump(spec.monthlyRate, idx) : 0,
      host: spec.host,
      rankUpBonus,
      benefits: spec.benefits,
    };
  });
}

export const VIP_TIERS: VipTier[] = buildTiers();

export const PLAYER_RANK: VipTier = {
  level: 0,
  name: "Player",
  family: "player",
  color: "#64748b",
  xp: 0,
  points: 0,
  rakeback: 0,
  dailyRate: 0,
  weeklyRate: 0,
  monthlyRate: 0,
  host: false,
  rankUpBonus: 0,
  benefits: ["Play Originals to earn XP", "1 XP per $1 casino wager", "Unlock Seed at $500 wagered"],
};

/** Casino bets: 1 XP per $1 USD wagered. */
export function xpFromCasinoWager(stakeUsd: number): number {
  if (!(stakeUsd > 0)) return 0;
  return Math.floor(stakeUsd);
}

export function pointsFromWager(wagered: number): number {
  return xpFromCasinoWager(wagered);
}

export function vipLevelForXp(xp: number): number {
  const points = Math.max(0, Math.floor(xp));
  let level = 0;
  for (const t of VIP_TIERS) if (points >= t.xp) level = t.level;
  return level;
}

/** @deprecated Use vipLevelForXp. Casino XP is 1:1 with $ wagered. */
export function vipLevelForWager(wagered: number): number {
  return vipLevelForXp(pointsFromWager(wagered));
}

export function vipTier(level: number): VipTier {
  if (level <= 0) return PLAYER_RANK;
  return VIP_TIERS[level - 1] ?? VIP_TIERS[VIP_TIERS.length - 1];
}

export function cashbackRate(level: number): number {
  return vipTier(level).rakeback;
}

export function vipProgress(xpOrWager: number): number {
  const xp = Math.max(0, Math.floor(xpOrWager));
  const level = vipLevelForXp(xp);
  const next = VIP_TIERS[level];
  if (!next) return 100;
  const prev = level === 0 ? 0 : VIP_TIERS[level - 1].xp;
  if (next.xp === prev) return 100;
  return Math.min(100, Math.max(0, ((xp - prev) / (next.xp - prev)) * 100));
}

export function nextVipTier(level: number): VipTier | null {
  return VIP_TIERS[level] ?? null;
}

export function familyRanks(family: VipFamily): VipTier[] {
  if (family === "player") return [PLAYER_RANK];
  return VIP_TIERS.filter((t) => t.family === family);
}

export const VIP_FAMILIES: Exclude<VipFamily, "player">[] = [
  "seed", "copper", "iron", "amber", "titanium", "emerald", "cobalt",
  "garnet", "onyx", "pearl", "serpent", "celestial", "void", "eternal",
];

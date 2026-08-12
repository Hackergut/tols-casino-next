/*
 * VIP / wager ladder — single source of truth for both the client (the VIP
 * page) and the server (auto-promotion on every bet). Total amount wagered is
 * the driver: cross a tier's threshold and the level updates everywhere.
 */

export interface VipTier {
  level: number;   // 1-based
  name: string;
  color: string;
  wager: number;   // cumulative total-wagered required to reach this tier
  rakeback: number; // instant rakeback rate for this tier, in %
}

export const VIP_TIERS: VipTier[] = [
  { level: 1, name: "Bronzo",   color: "#cd7f32", wager: 10_000,      rakeback: 5 },
  { level: 2, name: "Argento",  color: "#c0c0c0", wager: 50_000,      rakeback: 6 },
  { level: 3, name: "Oro",      color: "#ffd700", wager: 100_000,     rakeback: 7 },
  { level: 4, name: "Platino",  color: "#dfe4ea", wager: 250_000,     rakeback: 8 },
  { level: 5, name: "Giada",    color: "#3ddc97", wager: 1_000_000,   rakeback: 9 },
  { level: 6, name: "Zaffiro",  color: "#3b82f6", wager: 5_000_000,   rakeback: 10 },
  { level: 7, name: "Rubino",   color: "#e0115f", wager: 25_000_000,  rakeback: 11 },
  { level: 8, name: "Diamante", color: "#7ee8ff", wager: 100_000_000, rakeback: 12 },
];

// Benefit matrix. `from` = first tier level (1-based) the benefit unlocks at;
// it stays available for every tier above.
export const VIP_BENEFITS: { label: string; from: number }[] = [
  { label: "Rakeback istantaneo", from: 1 },
  { label: "Bonus di Avanzamento di Livello", from: 1 },
  { label: "Bonus Settimanale", from: 2 },
  { label: "Bonus Mensile", from: 3 },
  { label: "Aumento del bonus", from: 4 },
  { label: "Host VIP", from: 6 },
  { label: "Invito agli eventi", from: 8 },
];

/** The tier level earned for a given cumulative wager (0 = no tier yet). */
export function vipLevelForWager(wagered: number): number {
  let level = 0;
  for (const t of VIP_TIERS) if (wagered >= t.wager) level = t.level;
  return level;
}

export function vipTier(level: number): VipTier | null {
  return VIP_TIERS[level - 1] ?? null;
}

export function rakebackRate(level: number): number {
  return vipTier(level)?.rakeback ?? 0;
}

/** Progress (0–100) from the current tier toward the next. 100 at max tier. */
export function vipProgress(wagered: number): number {
  const level = vipLevelForWager(wagered);
  const next = VIP_TIERS[level];
  if (!next) return 100;
  const prev = level > 0 ? VIP_TIERS[level - 1].wager : 0;
  return Math.min(100, Math.max(0, ((wagered - prev) / (next.wager - prev)) * 100));
}

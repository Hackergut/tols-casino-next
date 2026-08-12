/*
 * VIP / wager ladder — single source of truth for the client (VIP page) and
 * the server (auto-promotion on every bet). Points are earned 1:1 from amount
 * wagered; crossing a tier's point threshold updates the level everywhere.
 */

export interface VipTier {
  level: number;      // 1-based
  name: string;
  color: string;
  points: number;     // cumulative points (= $ wagered) required to reach it
  cashback: number;   // weekly cashback %, 0 at entry tier
  benefits: string[]; // headline perks for this tier
}

export const VIP_TIERS: VipTier[] = [
  { level: 1, name: "Spark", color: "#facc15", points: 0,         cashback: 0,  benefits: ["Bonus di benvenuto", "Accesso a tutte le slot"] },
  { level: 2, name: "Blaze", color: "#fb7185", points: 500,       cashback: 5,  benefits: ["5% cashback settimanale", "20 free spin"] },
  { level: 3, name: "Storm", color: "#38bdf8", points: 2_000,     cashback: 7,  benefits: ["7% cashback", "50 free spin", "Bonus mensile"] },
  { level: 4, name: "Titan", color: "#cbd5e1", points: 10_000,    cashback: 10, benefits: ["10% cashback", "Prelievi prioritari", "Regalo di compleanno"] },
  { level: 5, name: "Nova",  color: "#c084fc", points: 50_000,    cashback: 12, benefits: ["12% cashback", "Account manager dedicato", "Tornei esclusivi"] },
  { level: 6, name: "Apex",  color: "#f59e0b", points: 200_000,   cashback: 15, benefits: ["15% cashback", "Inviti eventi VIP", "Limiti di puntata più alti"] },
  { level: 7, name: "Myth",  color: "#cdf32b", points: 1_000_000, cashback: 20, benefits: ["20% cashback", "Esperienze luxury", "Supporto 24/7 VIP", "Bonus personalizzati"] },
];

/** Points a player has earned (currently 1 point per $1 wagered). */
export function pointsFromWager(wagered: number): number {
  return Math.floor(wagered);
}

/** Tier level for a given point total. Everyone is at least level 1 (Spark). */
export function vipLevelForWager(wagered: number): number {
  const points = pointsFromWager(wagered);
  let level = 1;
  for (const t of VIP_TIERS) if (points >= t.points) level = t.level;
  return level;
}

export function vipTier(level: number): VipTier | null {
  return VIP_TIERS[level - 1] ?? null;
}

export function cashbackRate(level: number): number {
  return vipTier(level)?.cashback ?? 0;
}

/** Progress (0–100) from the current tier toward the next. 100 at max tier. */
export function vipProgress(wagered: number): number {
  const points = pointsFromWager(wagered);
  const level = vipLevelForWager(wagered);
  const next = VIP_TIERS[level];
  if (!next) return 100;
  const prev = VIP_TIERS[level - 1].points;
  return Math.min(100, Math.max(0, ((points - prev) / (next.points - prev)) * 100));
}

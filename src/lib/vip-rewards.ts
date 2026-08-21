/*
 * VIP reward periods and claim math.
 *
 * Amounts are derived from real settled bets (never practice). The unique
 * (userId, kind, periodKey) row makes a claim idempotent — clicking twice
 * cannot pay twice.
 */

import { vipTier, type VipTier } from "@/lib/vip";

export const VIP_MIN_CLAIM = 0.1;
export const VIP_RELOAD_RATE = 0.01;
export const VIP_BONUS_WAGERING = 3;

export type VipRewardKind = "daily" | "weekly" | "monthly" | "rakeback" | "reload";

export interface VipPeriod {
  kind: VipRewardKind;
  key: string;
  from: Date;
  to: Date;
  available: boolean;
  lockedReason?: string;
}

export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Yesterday 00:00 UTC → today 00:00 UTC. Available from 00:00 UTC every day. */
export function dailyPeriod(now = new Date()): VipPeriod {
  const today = utcDayStart(now);
  const from = new Date(today.getTime() - 86_400_000);
  return {
    kind: "daily",
    key: `daily:${utcYmd(from)}`,
    from,
    to: today,
    available: now >= today,
  };
}

/**
 * Weekly drop: Thursday 11:00 UTC. The claimable window is the 7 days
 * leading up to the most recent Thursday 11:00 that has already passed.
 */
export function weeklyPeriod(now = new Date()): VipPeriod {
  const day = now.getUTCDay(); // 0 Sun … 4 Thu
  const daysSinceThu = (day + 7 - 4) % 7;
  let drop = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceThu, 11, 0, 0));
  if (now < drop) drop = new Date(drop.getTime() - 7 * 86_400_000);
  const from = new Date(drop.getTime() - 7 * 86_400_000);
  return {
    kind: "weekly",
    key: `weekly:${utcYmd(drop)}`,
    from,
    to: drop,
    available: now >= drop,
  };
}

/** Previous calendar month, available from the 1st 00:00 UTC. */
export function monthlyPeriod(now = new Date()): VipPeriod {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const key = `monthly:${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  return { kind: "monthly", key, from, to, available: now >= to };
}

export function rewardAmount(wagered: number, ratePct: number): number {
  if (!(wagered > 0) || !(ratePct > 0)) return 0;
  return Math.round(wagered * (ratePct / 100) * 100) / 100;
}

export function reloadAmount(wagered7d: number): number {
  return Math.max(1, rewardAmount(wagered7d, VIP_RELOAD_RATE * 100));
}

export interface RewardOffer {
  kind: VipRewardKind;
  periodKey: string;
  amount: number;
  rate: number;
  wagered: number;
  eligible: boolean;
  claimed: boolean;
  available: boolean;
  unlocksAt?: string;
  label: string;
  detail: string;
}

export function describeOffer(kind: VipRewardKind, tier: VipTier): { label: string; detail: string; rate: number; eligible: boolean } {
  switch (kind) {
    case "daily":
      return {
        label: "Daily bonus",
        detail: "Copper and above. Drops every day at 00:00 UTC from the last 24 hours of bets.",
        rate: tier.dailyRate,
        eligible: tier.dailyRate > 0,
      };
    case "weekly":
      return {
        label: "Weekly bonus",
        detail: "Iron and above. Drops every Thursday at 11:00 UTC onto your VIP page.",
        rate: tier.weeklyRate,
        eligible: tier.weeklyRate > 0,
      };
    case "monthly":
      return {
        label: "Monthly bonus",
        detail: "Paid each month from your recent wagering. Added to the VIP page on the 1st.",
        rate: tier.monthlyRate,
        eligible: tier.monthlyRate > 0,
      };
    case "rakeback":
      return {
        label: "Rakeback",
        detail: "Every VIP member. A percentage of your casino wagers, claimable any time.",
        rate: tier.rakeback,
        eligible: tier.rakeback > 0,
      };
    case "reload":
      return {
        label: "Reload",
        detail: "Unlocked when you rank up, based on recent betting activity.",
        rate: VIP_RELOAD_RATE * 100,
        eligible: tier.level >= 1,
      };
  }
}

export function vipTierForLevel(level: number): VipTier {
  return vipTier(level);
}

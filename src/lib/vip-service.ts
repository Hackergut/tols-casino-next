import { db } from "@/lib/db";
import { creditBonus } from "@/lib/bonus";
import { VIP_TIERS, vipLevelForXp, vipTier } from "@/lib/vip";
import {
  VIP_MIN_CLAIM,
  VIP_BONUS_WAGERING,
  dailyPeriod,
  weeklyPeriod,
  monthlyPeriod,
  rewardAmount,
  reloadAmount,
  describeOffer,
  type RewardOffer,
  type VipRewardKind,
} from "@/lib/vip-rewards";

async function wageredBetween(userId: string, from: Date, to: Date): Promise<number> {
  const agg = await db.casinoBet.aggregate({
    where: {
      userId,
      createdAt: { gte: from, lt: to },
      result: { in: ["win", "lose", "push"] },
      amount: { gt: 0 },
    },
    _sum: { amount: true },
  });
  return Number(agg._sum.amount ?? 0);
}

async function claimedKeys(userId: string, kind: VipRewardKind): Promise<Set<string>> {
  const rows = await db.vipReward.findMany({
    where: { userId, kind, status: "claimed" },
    select: { periodKey: true },
  });
  return new Set(rows.map((r) => r.periodKey));
}

async function lastClaimedAt(userId: string, kind: VipRewardKind): Promise<Date | null> {
  const row = await db.vipReward.findFirst({
    where: { userId, kind, status: "claimed" },
    orderBy: { claimedAt: "desc" },
    select: { claimedAt: true },
  });
  return row?.claimedAt ?? null;
}

export async function listVipOffers(userId: string): Promise<{
  xp: number;
  level: number;
  wagered: number;
  tier: ReturnType<typeof vipTier>;
  next: ReturnType<typeof vipTier> | null;
  offers: RewardOffer[];
}> {
  const wallet = await db.casinoWallet.findUnique({ where: { userId } });
  const xp = Math.floor(wallet?.xp ?? 0);
  const earned = vipLevelForXp(xp);
  if (wallet && wallet.vipLevel !== earned) {
    await db.casinoWallet.update({ where: { userId }, data: { vipLevel: earned } });
  }
  const tier = vipTier(earned);
  const next = VIP_TIERS[earned] ?? null;

  const now = new Date();
  const daily = dailyPeriod(now);
  const weekly = weeklyPeriod(now);
  const monthly = monthlyPeriod(now);

  const [dailyClaimed, weeklyClaimed, monthlyClaimed, lastRakeback, pendingReloads, dailyW, weeklyW, monthlyW] =
    await Promise.all([
      claimedKeys(userId, "daily"),
      claimedKeys(userId, "weekly"),
      claimedKeys(userId, "monthly"),
      lastClaimedAt(userId, "rakeback"),
      db.vipReward.findMany({ where: { userId, kind: "reload", status: "pending" } }),
      wageredBetween(userId, daily.from, daily.to),
      wageredBetween(userId, weekly.from, weekly.to),
      wageredBetween(userId, monthly.from, monthly.to),
    ]);

  const rakeFrom = lastRakeback ?? new Date(now.getTime() - 7 * 86_400_000);
  const rakeW = await wageredBetween(userId, rakeFrom, now);

  const offers: RewardOffer[] = [];

  const pushPeriod = (
    kind: "daily" | "weekly" | "monthly",
    period: { key: string; available: boolean; to: Date },
    wagered: number,
    claimed: Set<string>,
  ) => {
    const meta = describeOffer(kind, tier);
    const amount = rewardAmount(wagered, meta.rate);
    offers.push({
      kind,
      periodKey: period.key,
      amount,
      rate: meta.rate,
      wagered,
      eligible: meta.eligible,
      claimed: claimed.has(period.key),
      available: period.available && meta.eligible && amount >= VIP_MIN_CLAIM && !claimed.has(period.key),
      unlocksAt: period.available ? undefined : period.to.toISOString(),
      label: meta.label,
      detail: meta.detail,
    });
  };

  pushPeriod("daily", daily, dailyW, dailyClaimed);
  pushPeriod("weekly", weekly, weeklyW, weeklyClaimed);
  pushPeriod("monthly", monthly, monthlyW, monthlyClaimed);

  const rakeMeta = describeOffer("rakeback", tier);
  const rakeAmount = rewardAmount(rakeW, rakeMeta.rate);
  offers.push({
    kind: "rakeback",
    periodKey: `rakeback:${utcStamp(now)}`,
    amount: rakeAmount,
    rate: rakeMeta.rate,
    wagered: rakeW,
    eligible: rakeMeta.eligible,
    claimed: false,
    available: rakeMeta.eligible && rakeAmount >= VIP_MIN_CLAIM,
    label: rakeMeta.label,
    detail: rakeMeta.detail,
  });

  const reloadMeta = describeOffer("reload", tier);
  for (const row of pendingReloads) {
    offers.push({
      kind: "reload",
      periodKey: row.periodKey,
      amount: row.amount,
      rate: reloadMeta.rate,
      wagered: 0,
      eligible: true,
      claimed: false,
      available: row.amount >= VIP_MIN_CLAIM,
      label: reloadMeta.label,
      detail: reloadMeta.detail,
    });
  }

  return {
    xp,
    level: earned,
    wagered: wallet?.totalWagered ?? 0,
    tier,
    next,
    offers,
  };
}

function utcStamp(d: Date): string {
  return d.toISOString().replace(/[:.]/g, "-");
}

export async function claimVipReward(userId: string, kind: VipRewardKind, periodKey?: string): Promise<{ amount: number; as: "real" | "bonus" }> {
  const snapshot = await listVipOffers(userId);
  const offer = snapshot.offers.find((o) => o.kind === kind && (!periodKey || o.periodKey === periodKey));
  if (!offer) throw Object.assign(new Error("Reward not found"), { status: 404 });
  if (!offer.eligible) throw Object.assign(new Error("Your rank does not unlock this reward yet"), { status: 403 });
  if (offer.claimed) throw Object.assign(new Error("Already claimed"), { status: 409 });
  if (!offer.available || offer.amount < VIP_MIN_CLAIM) {
    throw Object.assign(new Error("Nothing to claim right now"), { status: 400 });
  }

  const key = kind === "rakeback" ? `rakeback:${Date.now()}` : offer.periodKey;

  try {
    await db.vipReward.create({
      data: { userId, kind, periodKey: key, amount: offer.amount, status: "claimed", claimedAt: new Date() },
    });
  } catch {
    throw Object.assign(new Error("Already claimed"), { status: 409 });
  }

  if (kind === "reload") {
    await db.vipReward.updateMany({
      where: { userId, kind: "reload", periodKey: offer.periodKey, status: "pending" },
      data: { status: "claimed", claimedAt: new Date() },
    });
  }

  if (kind === "rakeback") {
    await db.casinoWallet.update({
      where: { userId },
      data: { balance: { increment: offer.amount } },
    });
    return { amount: offer.amount, as: "real" };
  }

  await creditBonus({
    userId,
    amount: offer.amount,
    multiplier: VIP_BONUS_WAGERING,
    source: "vip",
    reason: `${kind}:${key}`,
  });
  return { amount: offer.amount, as: "bonus" };
}

/** Called after a rank-up. Creates a pending reload based on the last 7 days of wagers. */
export async function grantReload(userId: string, newLevel: number): Promise<void> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 86_400_000);
  const wagered = await wageredBetween(userId, from, now);
  const amount = Math.round(reloadAmount(wagered) * 100) / 100;
  if (amount < VIP_MIN_CLAIM) return;
  try {
    await db.vipReward.create({
      data: {
        userId,
        kind: "reload",
        periodKey: `reload:${newLevel}`,
        amount,
        status: "pending",
        meta: JSON.stringify({ level: newLevel, wagered7d: wagered }),
      },
    });
  } catch {
    /* already granted for this level */
  }
}

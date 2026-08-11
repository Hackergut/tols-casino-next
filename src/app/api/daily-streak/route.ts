import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/daily-streak — get current streak status
export async function GET() {
  const user = await getSession();

  const setting = await db.platformSetting.findUnique({
    where: { key: `daily-streak-${user.id}` },
  });

  let data = { streak: 0, lastClaim: null as string | null, totalClaimed: 0 };
  if (setting) {
    try { data = JSON.parse(setting.value); } catch {}
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const lastClaimDate = data.lastClaim ? new Date(data.lastClaim) : null;
  const claimedToday = lastClaimDate && lastClaimDate.toISOString().split("T")[0] === today;

  // Check if streak is broken (more than 1 day since last claim)
  let streakBroken = false;
  if (lastClaimDate) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastClaimDay = lastClaimDate.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (lastClaimDay !== today && lastClaimDay !== yesterdayStr) {
      streakBroken = true;
    }
  }

  const currentStreak = streakBroken ? 0 : data.streak;

  // Reward schedule: day 1-6 = $5 * day, day 7 = $50 bonus
  const nextDay = (claimedToday ? currentStreak : currentStreak + 1);
  const nextReward = nextDay >= 7 ? 50 : nextDay * 5;

  return ok({
    streak: currentStreak,
    lastClaim: data.lastClaim,
    totalClaimed: data.totalClaimed,
    claimedToday: !!claimedToday,
    nextReward,
    nextDay: Math.min(7, nextDay),
    canClaim: !claimedToday,
  });
}

// POST /api/daily-streak — claim daily reward
export async function POST() {
  const user = await getSession();
  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("No wallet", 400);

  const setting = await db.platformSetting.findUnique({
    where: { key: `daily-streak-${user.id}` },
  });

  let data = { streak: 0, lastClaim: null as string | null, totalClaimed: 0 };
  if (setting) {
    try { data = JSON.parse(setting.value); } catch {}
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const lastClaimDate = data.lastClaim ? new Date(data.lastClaim) : null;
  const claimedToday = lastClaimDate && lastClaimDate.toISOString().split("T")[0] === today;
  if (claimedToday) return err("Already claimed today", 400);

  // Check if streak continues or resets
  let newStreak = 1;
  if (lastClaimDate) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastClaimDay = lastClaimDate.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    if (lastClaimDay === yesterdayStr) {
      newStreak = data.streak + 1;
      if (newStreak > 7) newStreak = 1; // reset after day 7
    }
  }

  const reward = newStreak >= 7 ? 50 : newStreak * 5;
  const newValue = JSON.stringify({
    streak: newStreak,
    lastClaim: now.toISOString(),
    totalClaimed: data.totalClaimed + reward,
  });

  // Upsert the setting
  await db.platformSetting.upsert({
    where: { key: `daily-streak-${user.id}` },
    update: { value: newValue },
    create: { key: `daily-streak-${user.id}`, value: newValue, category: "daily-streak" },
  });

  // Credit the wallet
  await db.casinoWallet.update({
    where: { userId: user.id },
    data: { balance: { increment: reward } },
  });

  return ok({
    streak: newStreak,
    reward,
    totalClaimed: data.totalClaimed + reward,
    claimedToday: true,
    nextReward: newStreak >= 7 ? 5 : (newStreak + 1) >= 7 ? 50 : (newStreak + 1) * 5,
    nextDay: Math.min(7, newStreak + 1),
    canClaim: false,
  });
}

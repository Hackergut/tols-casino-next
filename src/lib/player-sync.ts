import { db } from "@/lib/db";
import { vipLevelForWager } from "@/lib/vip";

/*
 * Player profile reconciliation.
 *
 * The platform has two views of a player. `CasinoUser` + `CasinoWallet` +
 * `CasinoBet` are the source of truth — the game flow writes them on every
 * bet. `PlayerProfile` is the operator-facing projection the admin panel reads
 * and filters on (segment, risk level, streaks), and nothing was keeping it in
 * sync, so the admin saw an empty roster while real players were betting.
 *
 * This derives the projection from the source tables. It is idempotent — it
 * can be re-run at any time and converges to the same result — so it works
 * both as a one-off backfill and as an after-bet refresh.
 */

/** Longest run and current run of a given result, newest-first bet list. */
function streaks(results: string[]): { current: number; maxWin: number; maxLose: number } {
  let current = 0, maxWin = 0, maxLose = 0, run = 0, prev: string | null = null;
  // Walk oldest → newest so "current" ends on the most recent run.
  for (const r of [...results].reverse()) {
    if (r === prev) run++;
    else { run = 1; prev = r; }
    if (r === "win") maxWin = Math.max(maxWin, run);
    else maxLose = Math.max(maxLose, run);
    current = r === "win" ? run : -run;
  }
  return { current, maxWin, maxLose };
}

/** Segment a player by lifetime wagered — mirrors the admin's filter values. */
function segmentFor(wagered: number): string {
  if (wagered >= 50_000) return "whale";
  if (wagered >= 10_000) return "high_roller";
  if (wagered >= 1_000) return "regular";
  return "standard";
}

/** Flag risk from how heavily a player is losing relative to what they staked. */
function riskFor(netProfit: number, wagered: number): string {
  if (wagered <= 0) return "normal";
  const ratio = netProfit / wagered;
  if (ratio <= -0.6) return "high";
  if (ratio <= -0.3) return "elevated";
  return "normal";
}

export async function syncPlayerProfile(userId: string): Promise<void> {
  const user = await db.casinoUser.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user) return;

  const [bets, depositAgg, withdrawalAgg] = await Promise.all([
    db.casinoBet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { amount: true, payout: true, result: true },
      take: 500, // streaks only need recent history
    }),
    db.casinoDeposit.aggregate({ where: { userId, credited: true }, _sum: { amount: true } }),
    db.casinoWithdrawal.aggregate({ where: { userId, status: "approved" }, _sum: { amount: true } }),
  ]);

  const wagered = bets.reduce((a, b) => a + b.amount, 0);
  const returned = bets.reduce((a, b) => a + b.payout, 0);
  const wins = bets.filter((b) => b.result === "win").length;
  const s = streaks(bets.map((b) => b.result));
  const netProfit = returned - wagered;

  const data = {
    username: user.username,
    email: user.email,
    totalDeposits: depositAgg._sum.amount ?? 0,
    totalWithdrawals: withdrawalAgg._sum.amount ?? 0,
    totalBets: bets.length,
    totalWins: wins,
    totalLosses: bets.length - wins,
    netProfit,
    currentStreak: s.current,
    maxWinStreak: s.maxWin,
    maxLoseStreak: s.maxLose,
    segment: segmentFor(user.wallet?.totalWagered ?? wagered),
    riskLevel: riskFor(netProfit, wagered),
  };

  await db.playerProfile.upsert({
    where: { externalId: userId },
    update: data,
    create: { externalId: userId, registeredAt: user.createdAt, ...data },
  });

  // Keep the wallet's VIP level in lockstep with total wagered — the single
  // wager ladder drives it, so the VIP page, header and admin all agree.
  const totalWagered = user.wallet?.totalWagered ?? wagered;
  const earned = vipLevelForWager(totalWagered);
  if (user.wallet && user.wallet.vipLevel !== earned) {
    await db.casinoWallet.update({ where: { userId }, data: { vipLevel: earned } });
  }
}

/** Rebuild every profile. Returns how many were reconciled. */
export async function syncAllPlayerProfiles(): Promise<number> {
  const users = await db.casinoUser.findMany({ select: { id: true } });
  for (const u of users) await syncPlayerProfile(u.id);
  return users.length;
}

/** Fire-and-forget refresh so a bet is never slowed down by reporting work. */
export function refreshPlayerProfile(userId: string): void {
  void syncPlayerProfile(userId).catch(() => {});
}

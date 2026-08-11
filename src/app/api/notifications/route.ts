import { db } from "@/lib/db";
import { getSession, ok } from "@/lib/session";

// GET /api/notifications — generates notifications from recent activity
export async function GET() {
  const user = await getSession();

  // Get recent wins (biggest first)
  const recentWins = await db.casinoBet.findMany({
    where: { userId: user.id, result: "win", payout: { gt: 5 } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Get recent deposits
  const recentDeposits = await db.casinoDeposit.findMany({
    where: { userId: user.id, status: "confirmed" },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // Get recent withdrawals
  const recentWithdrawals = await db.casinoWithdrawal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // Card pulls section removed — CardPull model does not exist

  const notifications: Array<{
    id: string;
    type: "win" | "deposit" | "withdrawal" | "card" | "bonus" | "system" | "social";
    title: string;
    message: string;
    amount?: number;
    createdAt: string;
    read: boolean;
  }> = [];

  for (const w of recentWins) {
    notifications.push({
      id: "win-" + w.id,
      type: "win",
      title: "Big Win!",
      message: `You won on ${w.gameName} at ${w.multiplier.toFixed(2)}×`,
      amount: w.payout,
      createdAt: w.createdAt.toISOString(),
      read: false,
    });
  }

  for (const d of recentDeposits) {
    notifications.push({
      id: "dep-" + d.id,
      type: "deposit",
      title: "Deposit Confirmed",
      message: `${d.chain} deposit confirmed`,
      amount: d.amount,
      createdAt: d.createdAt.toISOString(),
      read: false,
    });
  }

  for (const w of recentWithdrawals) {
    notifications.push({
      id: "wd-" + w.id,
      type: "withdrawal",
      title: w.status === "completed" ? "Withdrawal Completed" : "Withdrawal Processing",
      message: `${w.chain} withdrawal ${w.status}`,
      amount: w.amount,
      createdAt: w.createdAt.toISOString(),
      read: w.status === "completed",
    });
  }



  // Social notifications — big wins from followed players
  const followsSetting = await db.platformSetting.findUnique({
    where: { key: `follows-${user.id}` },
  });
  let followedIds: string[] = [];
  if (followsSetting) {
    try { followedIds = JSON.parse(followsSetting.value); } catch {}
  }
  if (followedIds.length > 0) {
    const socialWins = await db.casinoBet.findMany({
      where: {
        userId: { in: followedIds },
        result: "win",
        payout: { gt: 100 },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true } } },
    });
    for (const sw of socialWins) {
      notifications.push({
        id: "social-" + sw.id,
        type: "social",
        title: `🔥 ${sw.user?.username || "Player"} won big!`,
        message: `${sw.user?.username || "Player"} won ${sw.payout.toFixed(2)} USDT on ${sw.gameName} at ${sw.multiplier.toFixed(2)}×`,
        amount: sw.payout,
        createdAt: sw.createdAt.toISOString(),
        read: false,
      });
    }
  }

  // System notifications
  notifications.push({
    id: "sys-welcome",
    type: "system",
    title: "Welcome to TOLS Gaming",
    message: "Claim your 100% welcome bonus in Promotions!",
    createdAt: user.createdAt.toISOString(),
    read: false,
  });
  notifications.push({
    id: "sys-jackpot",
    type: "bonus",
    title: "Mega Drop Rising",
    message: "The progressive jackpot is growing — every bet feeds it!",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    read: true,
  });

  // Sort by date desc
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return ok({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  });
}

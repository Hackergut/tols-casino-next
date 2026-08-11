import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/social — get user's followed players + recent shared wins feed
export async function GET(req: NextRequest) {
  const user = await getSession();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // Get followed players from PlatformSetting
  const setting = await db.platformSetting.findUnique({
    where: { key: `follows-${user.id}` },
  });
  let followedIds: string[] = [];
  if (setting) {
    try { followedIds = JSON.parse(setting.value); } catch {}
  }

  const followedUsers = followedIds.length > 0
    ? await db.casinoUser.findMany({
        where: { id: { in: followedIds } },
        select: { id: true, username: true, avatarColor: true, level: true },
      })
    : [];

  // Get recent big wins from followed players (or all if none followed)
  const winnerIds = followedIds.length > 0 ? followedIds : [];
  const recentWins = await db.casinoBet.findMany({
    where: {
      result: "win",
      payout: { gt: 5 },
      ...(winnerIds.length > 0 ? { userId: { in: winnerIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { username: true, avatarColor: true } } },
  });

  const feed = recentWins.map((w) => ({
    id: w.id,
    username: w.user?.username || "Player",
    avatarColor: w.user?.avatarColor || "#ccff00",
    gameName: w.gameName,
    amount: w.amount,
    multiplier: w.multiplier,
    payout: w.payout,
    createdAt: w.createdAt.toISOString(),
    isFollowed: followedIds.includes(w.userId),
  }));

  return ok({
    followed: followedUsers.map((u) => ({ ...u, isFollowing: true })),
    feed,
    followingCount: followedIds.length,
  });
}

// POST /api/social — follow/unfollow a player
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body?.userId) return err("User ID required", 400);

  const targetUserId = body.userId;
  const action = body.action || "follow"; // "follow" | "unfollow"

  if (targetUserId === user.id) return err("Cannot follow yourself", 400);

  const target = await db.casinoUser.findUnique({ where: { id: targetUserId } });
  if (!target) return err("User not found", 404);

  const setting = await db.platformSetting.findUnique({
    where: { key: `follows-${user.id}` },
  });
  let followedIds: string[] = [];
  if (setting) {
    try { followedIds = JSON.parse(setting.value); } catch {}
  }

  if (action === "follow") {
    if (!followedIds.includes(targetUserId)) followedIds.push(targetUserId);
  } else {
    followedIds = followedIds.filter((id) => id !== targetUserId);
  }

  await db.platformSetting.upsert({
    where: { key: `follows-${user.id}` },
    update: { value: JSON.stringify(followedIds) },
    create: { key: `follows-${user.id}`, value: JSON.stringify(followedIds), category: "social" },
  });

  return ok({
    userId: targetUserId,
    username: target.username,
    action,
    followingCount: followedIds.length,
  });
}

import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { VIP_TIERS, PLAYER_RANK, VIP_FAMILIES, familyRanks, vipProgress } from "@/lib/vip";
import { claimVipReward, listVipOffers } from "@/lib/vip-service";
import type { VipRewardKind } from "@/lib/vip-rewards";

export async function GET() {
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }

  const snap = await listVipOffers(user.id);
  const pct = vipProgress(snap.xp);
  const families = VIP_FAMILIES.map((id) => ({
    id,
    ranks: familyRanks(id).map(publicTier),
  }));

  return ok({
    xp: snap.xp,
    level: snap.level,
    wagered: snap.wagered,
    progress: pct,
    tier: publicTier(snap.tier),
    next: snap.next ? publicTier(snap.next) : null,
    player: publicTier(PLAYER_RANK),
    families,
    ranks: VIP_TIERS.map(publicTier),
    offers: snap.offers,
    xpRule: "Casino bets earn 1 XP per $1 USD wagered. Sports, esports and novelty bets at odds of 1.10 or higher earn 3 XP per $1.",
    updatedAt: "2026-01-22",
  });
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  const body = await req.json().catch(() => null);
  const kind = body?.kind as VipRewardKind | undefined;
  if (!kind || !["daily", "weekly", "monthly", "rakeback", "reload"].includes(kind)) {
    return err("Unknown reward", 400);
  }
  try {
    const result = await claimVipReward(user.id, kind, typeof body?.periodKey === "string" ? body.periodKey : undefined);
    return ok(result);
  } catch (e) {
    const status = Number((e as { status?: number }).status ?? 400);
    return err(e instanceof Error ? e.message : "Claim failed", status);
  }
}

function publicTier(t: (typeof VIP_TIERS)[number]) {
  return {
    level: t.level,
    name: t.name,
    family: t.family,
    color: t.color,
    xp: t.xp,
    rakeback: t.rakeback,
    dailyRate: t.dailyRate,
    weeklyRate: t.weeklyRate,
    monthlyRate: t.monthlyRate,
    host: t.host,
    benefits: t.benefits,
  };
}

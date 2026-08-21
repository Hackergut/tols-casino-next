import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";

const ORIGINAL_GAMES = [
  { id: "crash", name: "Crash", baseRtp: 0.99 },
  { id: "dice", name: "Dice", baseRtp: 0.99 },
  { id: "mines", name: "Mines", baseRtp: 0.99 },
  { id: "wheel", name: "Wheel", baseRtp: 0.98 },
  { id: "keno", name: "Keno", baseRtp: 0.97 },
  { id: "limbo", name: "Limbo", baseRtp: 0.99 },
  { id: "plinko", name: "Plinko", baseRtp: 0.99 },
  { id: "coinflip", name: "Coinflip", baseRtp: 0.98 },
  { id: "shoot", name: "Shoot", baseRtp: 0.99 },
  { id: "poolrush", name: "Pool Rush", baseRtp: 0.96 },
  { id: "blackjack", name: "Blackjack 1V1", baseRtp: 0.9952 },
  { id: "roulette", name: "Roulette", baseRtp: 0.973 },
  { id: "slots", name: "Slots", baseRtp: 0.97 },
  { id: "scopa", name: "Scopa", baseRtp: 0.96 },
];

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "rtp:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: rtp:read" }, { status: 403 });
  }

  const rules = await db.gameControl.findMany({ where: { mode: "rtp", enabled: true }, orderBy: { priority: "desc" } });
  const games: Array<{
    gameId: string;
    gameName: string;
    baseRtp: number;
    rtpTarget: number;
    enabled: boolean;
    ruleId: string | null;
    recentBets: number;
    actualRtp: number | null;
  }> = [];
  for (const g of ORIGINAL_GAMES) {
    const bets = await db.casinoBet.findMany({
      where: { gameId: g.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { amount: true, payout: true, result: true },
    });
    const wagered = bets.reduce((s, b) => s + b.amount, 0);
    const returned = bets.reduce((s, b) => s + b.payout, 0);
    const rule = rules.find((r) => r.scope === "game" && r.gameId === g.id) || rules.find((r) => r.scope === "global");
    games.push({
      gameId: g.id,
      gameName: g.name,
      baseRtp: g.baseRtp,
      rtpTarget: rule?.rtpTarget ?? 1,
      enabled: Boolean(rule?.enabled),
      ruleId: rule?.id ?? null,
      recentBets: bets.length,
      actualRtp: wagered > 0 ? Math.round((returned / wagered) * 10000) / 100 : null,
    });
  }
  return NextResponse.json({ success: true, data: { games } });
}

export async function PUT(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "rtp:write")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: rtp:write" }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as { gameId?: string; rtpTarget?: number; enabled?: boolean; action?: "set" | "reset" } | null;
  if (!body?.gameId) return NextResponse.json({ success: false, error: "gameId required" }, { status: 400 });

  if (body.action === "reset") {
    await db.gameControl.updateMany({ where: { mode: "rtp", gameId: body.gameId, enabled: true }, data: { enabled: false } });
    return NextResponse.json({ success: true, data: { gameId: body.gameId, reset: true } });
  }

  if (typeof body.rtpTarget !== "number" || body.rtpTarget < 0 || body.rtpTarget > 2) {
    return NextResponse.json({ success: false, error: "rtpTarget must be 0..2 (1 = fair)" }, { status: 400 });
  }
  const isEnabled = body.enabled !== false;
  const existing = await db.gameControl.findFirst({ where: { mode: "rtp", gameId: body.gameId, scope: "game" } });
  const rule = existing
    ? await db.gameControl.update({ where: { id: existing.id }, data: { rtpTarget: body.rtpTarget, enabled: isEnabled, priority: 10 } })
    : await db.gameControl.create({
      data: { label: `RTP control: ${body.gameId}`, scope: "game", gameId: body.gameId, mode: "rtp", rtpTarget: body.rtpTarget, enabled: isEnabled, priority: 10 },
    });
  return NextResponse.json({ success: true, data: { gameId: body.gameId, rtpTarget: body.rtpTarget, enabled: isEnabled, ruleId: rule.id } });
}

export async function OPTIONS() {
  return platformOptions();
}

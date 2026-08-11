import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin, auditLog } from "@/lib/admin-auth";

// ── RTP control for Originals games ───────────────────────────────────
// This endpoint manages GameControl rules with mode="rtp" — the legitimate
// house-edge / RTP bias lever. force_win, force_lose and streak modes are
// rigging and are handled (and locked) in the separate game-controls page.

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
  { id: "roulette", name: "Roulette", baseRtp: 0.973 },
  { id: "slots", name: "Slots", baseRtp: 0.97 },
];

// GET /api/admin/rtp-control — list RTP rules + per-game stats
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  // Get all active RTP rules
  const rules = await db.gameControl.findMany({
    where: { mode: "rtp", enabled: true },
    orderBy: { priority: "desc" },
  });

  // Get actual bet stats per game (last 1000 bets)
  const gameStats: Record<string, { total: number; wins: number; wagered: number; returned: number }> = {};
  for (const g of ORIGINAL_GAMES) {
    const bets = await db.casinoBet.findMany({
      where: { gameId: g.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { amount: true, payout: true, result: true },
    });
    const wagered = bets.reduce((s, b) => s + b.amount, 0);
    const returned = bets.reduce((s, b) => s + b.payout, 0);
    gameStats[g.id] = {
      total: bets.length,
      wins: bets.filter((b) => b.result === "win").length,
      wagered,
      returned,
    };
  }

  // Merge game definitions with rules and stats
  const result = ORIGINAL_GAMES.map((g) => {
    const rule = rules.find((r) => r.scope === "game" && r.gameId === g.id) ||
                 rules.find((r) => r.scope === "global");
    const stats = gameStats[g.id];
    const actualRtp = stats.wagered > 0 ? stats.returned / stats.wagered : null;
    const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : null;

    return {
      gameId: g.id,
      gameName: g.name,
      baseRtp: g.baseRtp,
      // rtpTarget is the bias multiplier: 1 = normal, >1 = hot, <1 = cold
      rtpTarget: rule?.rtpTarget ?? 1,
      enabled: !!rule?.enabled,
      ruleId: rule?.id ?? null,
      betsAffected: rule?.betsAffected ?? 0,
      // Live stats from recent bets
      recentBets: stats.total,
      recentWins: stats.wins,
      recentWagered: stats.wagered,
      recentReturned: stats.returned,
      actualRtp: actualRtp !== null ? Math.round(actualRtp * 10000) / 100 : null,
      winRate: winRate !== null ? Math.round(winRate * 100) / 100 : null,
    };
  });

  return ok({ games: result });
}

// PUT /api/admin/rtp-control — set RTP bias for a game (or global)
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { gameId, rtpTarget, enabled, action } = body as {
    gameId?: string;
    rtpTarget?: number;
    enabled?: boolean;
    action?: "set" | "reset";
  };

  // Reset: disable the RTP rule for this game
  if (action === "reset") {
    if (!gameId) return err("gameId required for reset", 400);
    await db.gameControl.updateMany({
      where: { mode: "rtp", gameId, enabled: true },
      data: { enabled: false },
    });
    await auditLog(guard.session, "rtp.reset", { gameId });
    return ok({ gameId, reset: true });
  }

  // Set: create or update the RTP rule
  if (!gameId || typeof rtpTarget !== "number") return err("gameId and rtpTarget required", 400);
  if (rtpTarget < 0 || rtpTarget > 2) return err("rtpTarget must be between 0 and 2", 400);

  const isEnabled = enabled !== false;

  // Upsert: find existing RTP rule for this game, or create one
  const existing = await db.gameControl.findFirst({
    where: { mode: "rtp", gameId, scope: "game" },
  });

  let rule;
  if (existing) {
    rule = await db.gameControl.update({
      where: { id: existing.id },
      data: { rtpTarget, enabled: isEnabled, priority: 10 },
    });
  } else {
    rule = await db.gameControl.create({
      data: {
        label: `RTP control: ${gameId}`,
        scope: "game",
        gameId,
        mode: "rtp",
        rtpTarget,
        enabled: isEnabled,
        priority: 10,
      },
    });
  }

  await auditLog(guard.session, "rtp.set", { gameId, rtpTarget, enabled: isEnabled });

  return ok({
    gameId,
    rtpTarget,
    enabled: isEnabled,
    ruleId: rule.id,
  });
}
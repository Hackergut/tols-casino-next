import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkBetAllowed } from "@/lib/responsible-limits";
import { getEngine } from "@/lib/game-engines";
import { playInstantBet, BetError } from "@/lib/settle-bet";
import { startRound } from "@/lib/game-rounds";

export async function POST(req: NextRequest) {
  const limited = await rateLimit("bet", LIMITS.bet);
  if (limited) return limited;

  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  if (!user.wallet) return err("No wallet", 400);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { game, amount, clientSeed, payload, mode, autoBetId } = body as {
    game: string;
    amount: number;
    clientSeed?: string;
    payload?: Record<string, unknown>;
    mode?: string;
    autoBetId?: string;
  };

  if (!game || typeof amount !== "number" || amount <= 0) return err("Invalid bet", 400);

  const play = await checkBetAllowed(user.id, amount);
  if (!play.allowed) return err(play.message, 403);

  const engine = getEngine(game);
  if (!engine) return err("Unknown game: " + game, 400);

  const interactiveStart =
    engine.kind === "interactive" && (mode === "start" || game === "blackjack" || game === "scopa");

  try {
    const result = interactiveStart
      ? await startRound({
          userId: user.id,
          game,
          amount,
          clientSeed,
          payload: payload ?? {},
          autoBetId,
        })
      : await playInstantBet({
          userId: user.id,
          game,
          amount,
          clientSeed,
          payload: payload ?? {},
          autoBetId,
        });
    return ok(result);
  } catch (e) {
    if (e instanceof BetError) return err(e.message, e.status);
    console.error("[bets] POST", e);
    return err("Bet failed", 500);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));
  const bets = await db.casinoBet.findMany({
    where: { result: { not: "pending" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true, avatarColor: true } } },
  });
  return ok(
    bets.map((b) => ({
      id: b.id,
      gameName: b.gameName,
      gameCategory: b.gameCategory,
      amount: b.amount,
      multiplier: b.multiplier,
      payout: b.payout,
      result: b.result,
      createdAt: b.createdAt.toISOString(),
      username: b.user?.username || "Player",
      avatarColor: b.user?.avatarColor || "#ccff00",
    })),
  );
}

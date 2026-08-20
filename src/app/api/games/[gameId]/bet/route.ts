import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkBetAllowed } from "@/lib/responsible-limits";
import { getEngine } from "@/lib/game-engines";
import { playInstantBet, BetError } from "@/lib/settle-bet";
import { startRound } from "@/lib/game-rounds";

export async function POST(req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) {
  const limited = await rateLimit("bet", LIMITS.bet);
  if (limited) return limited;
  const { gameId } = await ctx.params;
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return err("Invalid bet", 400);
  const play = await checkBetAllowed(user.id, amount);
  if (!play.allowed) return err(play.message, 403);
  const engine = getEngine(gameId);
  if (!engine) return err("Unknown game", 404);
  const mode = String(body.mode ?? "");
  const interactiveStart =
    engine.kind === "interactive" && (mode === "start" || gameId === "blackjack" || gameId === "scopa");
  try {
    const result = interactiveStart
      ? await startRound({
          userId: user.id,
          game: gameId,
          amount,
          clientSeed: body.clientSeed,
          payload: body.payload ?? {},
        })
      : await playInstantBet({
          userId: user.id,
          game: gameId,
          amount,
          clientSeed: body.clientSeed,
          payload: body.payload ?? {},
        });
    return ok(result);
  } catch (e) {
    if (e instanceof BetError) return err(e.message, e.status);
    return err("Bet failed", 500);
  }
}

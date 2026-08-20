import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { applyAction } from "@/lib/game-rounds";
import { BetError } from "@/lib/settle-bet";

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
  if (!body?.roundId || !body?.action) return err("roundId and action are required", 400);
  try {
    const result = await applyAction({
      userId: user.id,
      game: gameId,
      roundId: String(body.roundId),
      action: typeof body.action === "string" ? { type: body.action, ...body } : body.action,
    });
    return ok(result);
  } catch (e) {
    if (e instanceof BetError) return err(e.message, e.status);
    return err("Action failed", 500);
  }
}

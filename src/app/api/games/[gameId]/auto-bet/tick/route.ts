import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { tickAutoBet } from "@/lib/auto-bet";
import { BetError } from "@/lib/settle-bet";

export async function POST(_req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const limited = await rateLimit("bet", LIMITS.bet);
  if (limited) return limited;
  const { gameId } = await ctx.params;
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  try {
    return ok(await tickAutoBet(user.id, gameId));
  } catch (e) {
    if (e instanceof BetError) return err(e.message, e.status);
    return err("Tick failed", 500);
  }
}

import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { startAutoBet } from "@/lib/auto-bet";
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
  if (!body) return err("Invalid body", 400);
  try {
    const status = await startAutoBet({ userId: user.id, gameId, params: body });
    return ok(status);
  } catch (e) {
    if (e instanceof BetError) return err(e.message, e.status);
    return err("Failed to start auto-bet", 500);
  }
}

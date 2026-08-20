import { getSession, ok, err } from "@/lib/session";
import { getAutoBetStatus } from "@/lib/auto-bet";

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  return ok(await getAutoBetStatus(user.id, gameId));
}

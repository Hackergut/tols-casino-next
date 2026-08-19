import { getSession, ok, err } from "@/lib/session";

import { stopAutoBet } from "@/lib/auto-bet";

export async function POST(_req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  const status = await stopAutoBet(user.id, gameId);
  if (!status) return err("No running auto-bet", 404);
  return ok(status);
}

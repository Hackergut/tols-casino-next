import { ok, err } from "@/lib/session";
import { getEngine, listEngines } from "@/lib/game-engines";
import { GAME_META } from "@/shared/constants";
import type { OriginalGameId } from "@/shared/types";

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await ctx.params;
  if (gameId === "all") {
    return ok(
      listEngines().map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        defaultParams: GAME_META[e.id].defaultParams,
      })),
    );
  }
  const engine = getEngine(gameId);
  if (!engine) return err("Unknown game", 404);
  const meta = GAME_META[gameId as OriginalGameId];
  return ok({
    id: engine.id,
    name: engine.name,
    kind: engine.kind,
    defaultParams: meta?.defaultParams ?? {},
  });
}

import { ok, err } from "@/lib/session";
import { getEngine, listEngines } from "@/lib/game-engines";
import { KENO_TABLES, PLINKO_TABLES, WHEEL_TABLES } from "@/lib/game-engines/tables";
import { GAME_META, KENO_DRAWS, KENO_MAX_PICKS, KENO_POOL, MIN_BET, MAX_BET, WHEEL_SEGMENTS } from "@/shared/constants";
import type { OriginalGameId } from "@/shared/types";

const TABLES: Record<string, unknown> = {
  plinko: PLINKO_TABLES,
  wheel: WHEEL_TABLES,
  keno: KENO_TABLES,
};

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
    minBet: MIN_BET,
    maxBet: MAX_BET,
    defaultParams: meta?.defaultParams ?? {},
    tables: TABLES[engine.id] ?? null,
    limits:
      engine.id === "keno"
        ? { pool: KENO_POOL, draws: KENO_DRAWS, maxPicks: KENO_MAX_PICKS }
        : engine.id === "wheel"
          ? { segments: WHEEL_SEGMENTS }
          : null,
  });
}

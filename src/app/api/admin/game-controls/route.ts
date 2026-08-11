import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ok, err } from "@/lib/session";

const VALID_MODES = ["normal", "force_win", "force_lose", "rtp", "streak"];
const VALID_SCOPES = ["global", "user", "game", "user_game"];

// GET /api/admin/game-controls — list all control rules with live counters
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const controls = await db.gameControl.findMany({ orderBy: [{ priority: "desc" }, { createdAt: "desc" }] });
  // Attach usernames for user-scoped rules.
  const userIds = [...new Set(controls.map((c) => c.userId).filter(Boolean))] as string[];
  const users = userIds.length
    ? await db.casinoUser.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.username]));
  return ok(
    controls.map((c) => ({
      ...c,
      username: c.userId ? nameById.get(c.userId) ?? null : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  );
}

// POST /api/admin/game-controls — create a control rule
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  const scope = String(body.scope ?? "global");
  const mode = String(body.mode ?? "normal");
  if (!VALID_SCOPES.includes(scope)) return err("Invalid scope", 400);
  if (!VALID_MODES.includes(mode)) return err("Invalid mode", 400);
  if ((scope === "user" || scope === "user_game") && !body.userId) return err("userId required for this scope", 400);
  if ((scope === "game" || scope === "user_game") && !body.gameId) return err("gameId required for this scope", 400);

  const control = await db.gameControl.create({
    data: {
      label: String(body.label ?? ""),
      scope,
      userId: body.userId ? String(body.userId) : null,
      gameId: body.gameId ? String(body.gameId) : null,
      mode,
      rtpTarget: typeof body.rtpTarget === "number" ? body.rtpTarget : 0.99,
      winStreak: Number.isFinite(Number(body.winStreak)) ? Number(body.winStreak) : 0,
      loseStreak: Number.isFinite(Number(body.loseStreak)) ? Number(body.loseStreak) : 0,
      forcedMultiplier: typeof body.forcedMultiplier === "number" ? body.forcedMultiplier : null,
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
      note: String(body.note ?? ""),
      enabled: body.enabled !== false,
    },
  });
  return ok(control);
}

// PUT /api/admin/game-controls — update a rule (toggle, retune, reset streak)
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id required", 400);

  const data: Record<string, unknown> = {};
  for (const k of ["label", "note"]) if (typeof body[k] === "string") data[k] = body[k];
  for (const k of ["rtpTarget", "forcedMultiplier"]) if (typeof body[k] === "number") data[k] = body[k];
  for (const k of ["winStreak", "loseStreak", "priority"]) if (Number.isFinite(Number(body[k]))) data[k] = Number(body[k]);
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.mode && VALID_MODES.includes(String(body.mode))) data.mode = String(body.mode);
  if (body.resetStreak) data.streakPos = 0;

  const control = await db.gameControl.update({ where: { id: String(body.id) }, data });
  return ok(control);
}

// DELETE /api/admin/game-controls?id=... — remove a rule
export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return err("id required", 400);
  await db.gameControl.delete({ where: { id } }).catch(() => {});
  return ok({ deleted: true });
}

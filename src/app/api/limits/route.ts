import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/limits — current user's responsible gaming limits
export async function GET() {
  const user = await getSession();
  const limits = await db.responsibleLimit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return ok(
    limits.map((l) => ({
      id: l.id,
      type: l.type,
      limitValue: l.limitValue,
      period: l.period,
      active: l.active,
      excludeUntil: l.excludeUntil?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    }))
  );
}

// POST /api/limits — set a new responsible gaming limit
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { type, limitValue, period, excludeUntil } = body as {
    type: string;
    limitValue?: number;
    period?: string;
    excludeUntil?: string;
  };

  const validTypes = ["self_exclusion", "deposit", "loss", "wager", "session"];
  const validPeriods = ["daily", "weekly", "monthly", "permanent", "custom"];
  if (!validTypes.includes(type)) return err("Invalid limit type", 400);

  const data: {
    userId: string;
    type: string;
    limitValue: number;
    period: string;
    active: boolean;
    excludeUntil?: Date;
  } = {
    userId: user.id,
    type,
    limitValue: typeof limitValue === "number" ? limitValue : 0,
    period: validPeriods.includes(period || "") ? (period as string) : "daily",
    active: true,
  };

  if (type === "self_exclusion" && excludeUntil) {
    const d = new Date(excludeUntil);
    if (!isNaN(d.getTime())) data.excludeUntil = d;
  }

  // Deactivate previous limits of same type
  await db.responsibleLimit.updateMany({
    where: { userId: user.id, type, active: true },
    data: { active: false },
  });

  const limit = await db.responsibleLimit.create({ data });
  return ok({
    id: limit.id,
    type: limit.type,
    limitValue: limit.limitValue,
    period: limit.period,
    active: limit.active,
    excludeUntil: limit.excludeUntil?.toISOString() ?? null,
    createdAt: limit.createdAt.toISOString(),
  });
}

// PUT /api/limits — update (toggle active, change value, or remove)
export async function PUT(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body?.id) return err("Limit id required", 400);

  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.limitValue === "number") data.limitValue = body.limitValue;

  const limit = await db.responsibleLimit.updateMany({
    where: { id: body.id, userId: user.id },
    data,
  });
  if (limit.count === 0) return err("Limit not found", 404);
  return ok({ updated: limit.count });
}

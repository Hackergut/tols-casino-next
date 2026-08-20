import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";
import { creditBonus } from "@/lib/bonus";

// Operator bonus controls — mirrors the Governance bridge (`governance.bonus_credit`)
// so the same "bonus money is real value but locked until wagered" semantics
// are available directly from the admin, and the loop is testable without the
// Tower.

// GET /api/admin/bonus — all bonus credits across players, newest first.
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const credits = await db.bonusCredit.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return ok(
    credits.map((c) => ({
      id: c.id,
      userId: c.userId,
      amount: c.amount,
      multiplier: c.multiplier,
      status: c.status,
      source: c.source,
      reason: c.reason,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      releasedAt: c.releasedAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  );
}

// POST /api/admin/bonus { userId, amount, multiplier?, reason?, expiresAt? }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const userId = String(body.userId ?? "");
  const amount = Number(body.amount);
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return err("userId and a positive amount are required", 400);
  }

  const credited = await creditBonus({
    userId,
    amount,
    multiplier: Number.isFinite(Number(body.multiplier)) ? Number(body.multiplier) : undefined,
    source: "operator",
    reason: String(body.reason ?? "Operator bonus credit"),
    expiresAt: body.expiresAt ?? null,
  });

  return ok(credited, 201);
}

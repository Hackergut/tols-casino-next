import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/ops/stars?status=pending — list Telegram Stars deposits (operator).
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 100));

  const rows = await db.starsDeposit.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { username: true } } },
  });
  const agg = await db.starsDeposit.aggregate({
    where: { status: "paid" },
    _sum: { usdtAmount: true },
    _count: { _all: true },
  });
  return ok({
    paidCount: agg._count._all,
    paidUsdt: agg._sum.usdtAmount ?? 0,
    deposits: rows.map((d) => ({
      id: d.id,
      userId: d.userId,
      username: d.user?.username ?? "",
      usdtAmount: d.usdtAmount,
      starsAmount: d.starsAmount,
      status: d.status,
      invoiceLink: d.invoiceLink,
      createdAt: d.createdAt.toISOString(),
      paidAt: d.paidAt?.toISOString() ?? null,
    })),
  });
}

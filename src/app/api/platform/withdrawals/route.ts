import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";

/**
 * GET /api/platform/withdrawals — JWT RS256 required
 * Query: ?status=pending|approved|rejected|all&limit=50&offset=0&userId=...
 */
export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "withdrawals:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: withdrawals:read" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");
  const chain = searchParams.get("chain");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (userId) where.userId = userId;
  if (chain) where.chain = chain;

  const [rows, total, pendingAgg] = await Promise.all([
    db.casinoWithdrawal.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    db.casinoWithdrawal.count({ where: where as never }),
    db.casinoWithdrawal.aggregate({
      where: { status: "pending" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map((w) => ({
      id: w.id,
      userId: w.userId,
      username: w.user?.username ?? null,
      email: w.user?.email ?? null,
      amount: w.amount,
      currency: w.currency,
      chain: w.chain,
      walletAddress: w.walletAddress,
      status: w.status,
      txHash: w.txHash,
      balanceBefore: w.balanceBefore,
      balanceAfter: w.balanceAfter,
      processedDate: w.processedDate?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    pending: { count: pendingAgg._count._all, amount: pendingAgg._sum.amount ?? 0 },
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}

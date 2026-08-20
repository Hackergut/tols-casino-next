import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";

/**
 * GET /api/platform/deposits — JWT RS256 required
 * Query: ?status=pending|confirmed|all&limit=50&offset=0&chain=solana&userId=...
 * Returns the Casino's real deposits (removes the governance mock).
 */
export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "deposits:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: deposits:read" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending | confirmed | failed | all
  const chain = searchParams.get("chain");
  const userId = searchParams.get("userId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(searchParams.get("offset") || 0));

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (chain) where.chain = chain;
  if (userId) where.userId = userId;

  const [rows, total] = await Promise.all([
    db.casinoDeposit.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    db.casinoDeposit.count({ where: where as never }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map((d) => ({
      id: d.id,
      userId: d.userId,
      username: d.user?.username ?? null,
      email: d.user?.email ?? null,
      chain: d.chain,
      currency: d.currency,
      amount: d.amount,
      fromAddress: d.fromAddress,
      toAddress: d.toAddress,
      txHash: d.txHash,
      status: d.status,
      credited: d.credited,
      referralCode: d.referralCode,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}

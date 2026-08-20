import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";

/**
 * GET /api/platform/payments — JWT RS256
 * Returns payment aggregates for governance (deposits + withdrawals) and verifies a tx if ?txHash=
 * Query: ?chain=solana&limit=50&txHash=0x...
 */
export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "payments:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: payments:read" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("txHash");
  const chain = searchParams.get("chain");

  if (txHash) {
    const dep = await db.casinoDeposit.findFirst({ where: { txHash } });
    const wit = await db.casinoWithdrawal.findFirst({ where: { txHash } });
    return NextResponse.json({ success: true, data: { found: Boolean(dep || wit), deposit: dep || null, withdrawal: wit || null } });
  }

  const limit = Math.min(100, Number(searchParams.get("limit") || 20));
  const whereChain = chain ? { chain } : {};

  const [depositsAgg, withdrawalsAgg, recentDeposits, recentWithdrawals] = await Promise.all([
    db.casinoDeposit.aggregate({ where: whereChain as never, _sum: { amount: true }, _count: { _all: true } }),
    db.casinoWithdrawal.aggregate({ where: { ...whereChain, status: "approved" } as never, _sum: { amount: true }, _count: { _all: true } }),
    db.casinoDeposit.findMany({ where: whereChain as never, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, chain: true, amount: true, status: true, txHash: true, createdAt: true } }),
    db.casinoWithdrawal.findMany({ where: whereChain as never, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, chain: true, amount: true, status: true, txHash: true, walletAddress: true, createdAt: true } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      deposits: { count: depositsAgg._count._all, totalAmount: depositsAgg._sum.amount ?? 0, recent: recentDeposits },
      withdrawals: { count: withdrawalsAgg._count._all, totalAmount: withdrawalsAgg._sum.amount ?? 0, recent: recentWithdrawals },
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}

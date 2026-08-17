import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth } from "@/lib/platform-auth";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;

  const [betsAgg, depositsAgg, withdrawalsPending] = await Promise.all([
    db.casinoBet.aggregate({ _count: { _all: true }, _sum: { amount: true, payout: true } }),
    db.casinoDeposit.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    db.casinoWithdrawal.aggregate({ where: { status: "pending" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  const userCount = await db.casinoUser.count().catch(() => 0);

  return NextResponse.json({
    success: true,
    data: {
      users: userCount,
      bets: { count: betsAgg._count._all, wagered: betsAgg._sum.amount ?? 0, payout: betsAgg._sum.payout ?? 0 },
      deposits: { count: depositsAgg._count._all, total: depositsAgg._sum.amount ?? 0 },
      withdrawals: { pendingCount: withdrawalsPending._count._all, pendingAmount: withdrawalsPending._sum.amount ?? 0 },
      ts: new Date().toISOString(),
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}

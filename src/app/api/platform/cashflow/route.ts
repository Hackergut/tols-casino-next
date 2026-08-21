import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "payments:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: payments:read" }, { status: 403 });
  }

  const [deposits, withdrawals, house, bets] = await Promise.all([
    db.casinoDeposit.groupBy({ by: ["status"], _sum: { amount: true, amountUsd: true }, _count: { _all: true } }),
    db.casinoWithdrawal.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
    db.houseEarning.aggregate({ _sum: { houseProfit: true, wager: true, payout: true }, _count: { _all: true } }),
    db.casinoBet.aggregate({ _sum: { amount: true, payout: true }, _count: { _all: true } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      deposits: deposits.map((d) => ({ status: d.status, count: d._count._all, amount: d._sum.amountUsd || d._sum.amount || 0 })),
      withdrawals: withdrawals.map((w) => ({ status: w.status, count: w._count._all, amount: w._sum.amount ?? 0 })),
      house: {
        bets: house._count._all,
        wagered: house._sum.wager ?? 0,
        paid: house._sum.payout ?? 0,
        profit: house._sum.houseProfit ?? 0,
      },
      wagers: { count: bets._count._all, staked: bets._sum.amount ?? 0, returned: bets._sum.payout ?? 0 },
      ts: new Date().toISOString(),
    },
  });
}

export async function OPTIONS() {
  return platformOptions();
}

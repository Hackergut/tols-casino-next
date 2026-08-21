import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    users,
    signups24h,
    wallets,
    deposits,
    withdrawalsPending,
    bets24h,
    house24h,
  ] = await Promise.all([
    db.casinoUser.count(),
    db.casinoUser.count({ where: { createdAt: { gte: dayAgo } } }),
    db.casinoWallet.aggregate({ _sum: { balance: true, bonusBalance: true, totalWagered: true, totalWon: true } }),
    db.casinoDeposit.aggregate({ _sum: { amountUsd: true, amount: true }, _count: { _all: true } }),
    db.casinoWithdrawal.aggregate({ where: { status: "pending" }, _sum: { amount: true }, _count: { _all: true } }),
    db.casinoBet.aggregate({ where: { createdAt: { gte: dayAgo } }, _count: { _all: true }, _sum: { amount: true, payout: true } }),
    db.houseEarning.aggregate({ where: { createdAt: { gte: dayAgo } }, _sum: { houseProfit: true, wager: true, payout: true } }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      users: { total: users, signups24h },
      wallets: {
        balance: wallets._sum.balance ?? 0,
        bonus: wallets._sum.bonusBalance ?? 0,
        wagered: wallets._sum.totalWagered ?? 0,
        won: wallets._sum.totalWon ?? 0,
      },
      deposits: { count: deposits._count._all, amount: deposits._sum.amountUsd || deposits._sum.amount || 0 },
      withdrawals: { pendingCount: withdrawalsPending._count._all, pendingAmount: withdrawalsPending._sum.amount ?? 0 },
      last24h: {
        bets: bets24h._count._all,
        wagered: bets24h._sum.amount ?? 0,
        paid: bets24h._sum.payout ?? 0,
        houseProfit: house24h._sum.houseProfit ?? 0,
      },
      ts: new Date().toISOString(),
    },
  });
}

export async function OPTIONS() {
  return platformOptions();
}

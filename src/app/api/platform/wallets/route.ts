import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { pageParams, platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "wallets:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: wallets:read" }, { status: 403 });
  }
  const url = new URL(req.url);
  const { limit, offset, q } = pageParams(url);
  const where = q
    ? { user: { OR: [{ username: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }, { id: q }] } }
    : {};

  const [rows, total] = await Promise.all([
    db.casinoWallet.findMany({
      where,
      orderBy: { totalWagered: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, username: true, email: true, status: true } } },
    }),
    db.casinoWallet.count({ where }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map((w) => ({
      userId: w.userId,
      username: w.user.username,
      email: w.user.email,
      status: w.user.status,
      balance: w.balance,
      bonusBalance: w.bonusBalance,
      wageringRemaining: w.wageringRemaining,
      currency: w.currency,
      vipLevel: w.vipLevel,
      xp: w.xp,
      totalWagered: w.totalWagered,
      totalWon: w.totalWon,
      updatedAt: w.updatedAt.toISOString(),
    })),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
}

export async function OPTIONS() {
  return platformOptions();
}

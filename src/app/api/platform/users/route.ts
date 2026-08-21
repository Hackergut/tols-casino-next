import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformAuth, hasScope } from "@/lib/platform-auth";
import { pageParams, platformOptions } from "@/lib/platform-http";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;
  if (!hasScope(auth.claims, "users:read")) {
    return NextResponse.json({ success: false, error: "Insufficient scope: users:read" }, { status: 403 });
  }

  const url = new URL(req.url);
  const { limit, offset, q } = pageParams(url);
  const status = url.searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { id: q },
    ];
  }

  const [rows, total] = await Promise.all([
    db.casinoUser.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true, username: true, email: true, role: true, status: true, level: true,
        kycStatus: true, googleId: true, createdAt: true,
        wallet: { select: { balance: true, bonusBalance: true, vipLevel: true, totalWagered: true, currency: true } },
      },
    }),
    db.casinoUser.count({ where: where as never }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      level: u.level,
      kycStatus: u.kycStatus,
      googleLinked: Boolean(u.googleId),
      registeredAt: u.createdAt.toISOString(),
      wallet: u.wallet,
    })),
    pagination: { total, limit, offset, hasMore: offset + rows.length < total },
  });
}

export async function OPTIONS() {
  return platformOptions();
}

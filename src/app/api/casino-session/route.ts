import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEMO_EMAIL = "demo@tols.gg";

// GET /api/casino-session — returns the demo user + wallet (creates if needed)
export async function GET() {
  try {
    let user = await db.casinoUser.findUnique({
      where: { email: DEMO_EMAIL },
      include: { wallet: true },
    });

    if (!user) {
      user = await db.casinoUser.create({
        data: {
          username: `Player_${Math.floor(Math.random() * 90000) + 10000}`,
          email: DEMO_EMAIL,
          avatarColor: "#ccff00",
          wallet: {
            create: {
              balance: 1000,
              currency: "USDT",
            },
          },
        },
        include: { wallet: true },
      });
    } else if (!user.wallet) {
      user = await db.casinoUser.update({
        where: { id: user.id },
        data: {
          wallet: {
            create: {
              balance: 1000,
              currency: "USDT",
            },
          },
        },
        include: { wallet: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarColor: user.avatarColor,
          level: user.level,
          xp: user.xp,
          role: user.role,
        },
        wallet: user.wallet
          ? {
              balance: user.wallet.balance,
              currency: user.wallet.currency,
              vipLevel: user.wallet.vipLevel,
              xp: user.wallet.xp,
              totalWagered: user.wallet.totalWagered,
              totalWon: user.wallet.totalWon,
              depositAddresses: user.wallet.depositAddresses,
            }
          : null,
        balance: user.wallet?.balance ?? 0,
      },
    });
  } catch (error) {
    console.error("[casino-session] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

// PUT /api/casino-session — update username / avatarColor
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body.username === "string" && body.username.trim()) {
      data.username = body.username.trim().slice(0, 24);
    }
    if (typeof body.avatarColor === "string") {
      data.avatarColor = body.avatarColor;
    }

    const updated = await db.casinoUser.update({
      where: { email: DEMO_EMAIL },
      data,
      include: { wallet: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        avatarColor: updated.avatarColor,
      },
    });
  } catch (error) {
    console.error("[casino-session] PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}

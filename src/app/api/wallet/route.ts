import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEMO_EMAIL = "demo@tols.gg";

// GET /api/wallet — wallet balance and stats for demo user
export async function GET() {
  try {
    const user = await db.casinoUser.findUnique({
      where: { email: DEMO_EMAIL },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        balance: user.wallet.balance,
        currency: user.wallet.currency,
        vipLevel: user.wallet.vipLevel,
        xp: user.wallet.xp,
        totalWagered: user.wallet.totalWagered,
        totalWon: user.wallet.totalWon,
        depositAddresses: user.wallet.depositAddresses,
      },
    });
  } catch (error) {
    console.error("[wallet] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}

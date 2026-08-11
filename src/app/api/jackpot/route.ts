import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/jackpot — global mega drop
export async function GET() {
  try {
    let jp = await db.globalJackpot.findUnique({ where: { id: "global" } });

    if (!jp) {
      jp = await db.globalJackpot.create({
        data: { id: "global", amount: 50000, currency: "USDT" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        amount: jp.amount,
        currency: jp.currency,
        contributionsCount: jp.contributionsCount,
        lastWinner: jp.lastWinner,
        lastWinAmount: jp.lastWinAmount,
        lastWinDate: jp.lastWinDate,
        description: jp.description,
      },
    });
  } catch (error) {
    console.error("[jackpot] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jackpot" },
      { status: 500 }
    );
  }
}

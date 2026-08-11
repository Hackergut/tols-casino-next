import { NextResponse } from "next/server";

// GET /api/stats — platform stats (hardcoded demo data)
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        totalBets: 5284,
        totalWagered: 2847193.52,
        totalPlayers: 1247,
        onlinePlayers: 183,
        houseProfit: 87624.18,
      },
    });
  } catch (error) {
    console.error("[stats] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

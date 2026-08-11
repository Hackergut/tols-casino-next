import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/search?q=query — search games by name or provider
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    if (!q || q.length < 1) {
      return NextResponse.json({ success: true, data: [] });
    }

    const games = await db.casinoGame.findMany({
      where: {
        enabled: true,
        OR: [
          { name: { contains: q } },
          { provider: { contains: q } },
        ],
      },
      take: 12,
      orderBy: { popularity: "desc" },
      select: {
        id: true,
        alias: true,
        name: true,
        provider: true,
        category: true,
        imageUrl: true,
        rtp: true,
        volatility: true,
        minBet: true,
        maxBet: true,
        popularity: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: games,
    });
  } catch (error) {
    console.error("[search] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search games" },
      { status: 500 }
    );
  }
}

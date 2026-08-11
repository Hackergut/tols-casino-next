import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/games-lobby?category=originals|slots|live|table|instant|all&featured=true
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured") === "true";

    const where: Record<string, unknown> = { enabled: true };
    if (category && category !== "all") where.category = category;
    if (featured) where.featured = true;

    const games = await db.casinoGame.findMany({
      where,
      orderBy: { popularity: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: games.map((g) => ({
        id: g.id,
        slug: g.alias,
        name: g.name,
        provider: g.provider,
        category: g.category,
        imageUrl: g.imageUrl,
        thumbnailUrl: g.thumbnailUrl,
        rtp: g.rtp,
        volatility: g.volatility,
        isLive: g.isLive,
        featured: g.featured,
        isNew: g.isNew,
        description: g.description,
        minBet: g.minBet,
        maxBet: g.maxBet,
        popularity: g.popularity,
        gameType: g.gameType,
      })),
    });
  } catch (error) {
    console.error("[games-lobby] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

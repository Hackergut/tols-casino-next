import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/providers — all game providers with game count, categories, max popularity
export async function GET() {
  try {
    const games = await db.casinoGame.findMany({
      where: { enabled: true },
      select: { provider: true, category: true, popularity: true },
    });

    const providerSlugs: Record<string, string> = {
      "TOLS Originals": "tols-originals",
      "TOLS Studios": "tols-studios",
      Pragmatic: "pragmatic",
      Hacksaw: "hacksaw",
      Evolution: "evolution",
      Relax: "relax",
      Spribe: "spribe",
      Evoplay: "evoplay",
      Habanero: "habanero",
      "ELK Studios": "elk-studios",
      "Big Time Gaming": "big-time-gaming",
      "Red Tiger": "red-tiger",
      Thunderkick: "thunderkick",
      Endorphina: "endorphina",
      Yggdrasil: "yggdrasil",
      "PG Soft": "pg-soft",
      Betsoft: "betsoft",
      "Booming Games": "booming-games",
      "Play'n GO": "playngo",
    };

    const stats = new Map<
      string,
      { count: number; maxPopularity: number; categories: Set<string> }
    >();

    for (const g of games) {
      let s = stats.get(g.provider);
      if (!s) {
        s = { count: 0, maxPopularity: 0, categories: new Set() };
        stats.set(g.provider, s);
      }
      s.count += 1;
      if (g.popularity > s.maxPopularity) s.maxPopularity = g.popularity;
      s.categories.add(g.category);
    }

    const providers = Array.from(stats.entries())
      .map(([name, s]) => {
        const slug =
          providerSlugs[name] || name.toLowerCase().replace(/\s+/g, "-");
        return {
          name,
          slug,
          logo: `/providers/${slug}.webp`,
          gameCount: s.count,
          categories: Array.from(s.categories),
          maxPopularity: s.maxPopularity,
        };
      })
      .sort((a, b) => b.maxPopularity - a.maxPopularity);

    return NextResponse.json({
      success: true,
      data: providers,
    });
  } catch (error) {
    console.error("[providers] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}

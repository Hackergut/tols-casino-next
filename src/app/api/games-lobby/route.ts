import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ORIGINALS, type OriginalMeta } from "@/lib/originals-registry";

const ORIGINAL_PROVIDER = "TOLS Originals";

// GET /api/games-lobby?category=originals|slots|live|table|instant|all&featured=true&vendor=eurovirtuals
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured") === "true";
    const vendor = searchParams.get("vendor");

    const where: Record<string, unknown> = { enabled: true };
    if (category && category !== "all") where.category = category;
    if (featured) where.featured = true;
    if (vendor) where.provider = { equals: vendor, mode: "insensitive" };

    const games = await db.casinoGame.findMany({
      where,
      orderBy: { popularity: "desc" },
    });

    const catalog = games.map((g) => {
      const game = {
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
      };

      const original = ORIGINALS.find((entry) => entry.id === g.alias);
      return original ? overlayOriginal(game, original) : game;
    });

    // The DB catalog is editable operational data, while ORIGINALS is the
    // deploy-time source of truth for in-house games. Add registered games
    // that have not been seeded yet so a deploy can never publish a playable
    // Original without its lobby card.
    const returnedSlugs = new Set(catalog.map((game) => game.slug));
    for (const original of ORIGINALS) {
      if (!returnedSlugs.has(original.id) && originalMatchesQuery(original, category, featured, vendor)) {
        catalog.push(overlayOriginal({
          id: `original-${original.id}`,
          slug: original.id,
          name: original.name,
          provider: ORIGINAL_PROVIDER,
          category: "originals",
          imageUrl: original.image,
          thumbnailUrl: original.image,
          rtp: original.rtp * 100,
          volatility: original.volatility,
          isLive: false,
          featured: false,
          isNew: false,
          description: original.description,
          minBet: 0.01,
          maxBet: 100,
          popularity: 0,
          gameType: "original",
        }, original));
      }
    }

    // Catalog is public, changes rarely, and is re-fetched on every lobby
    // mount — cache it at the edge (low-latency-systems skill) so repeat
    // visits skip the DB read entirely.
    return NextResponse.json({ success: true, data: catalog }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[games-lobby] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

type LobbyCatalogGame = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  imageUrl: string;
  thumbnailUrl: string;
  rtp: number | null;
  volatility: string | null;
  isLive: boolean;
  featured: boolean;
  isNew: boolean;
  description: string | null;
  minBet: number;
  maxBet: number;
  popularity: number;
  gameType: string;
};

/** Apply canonical metadata while retaining DB-only operational values. */
function overlayOriginal(game: LobbyCatalogGame, original: OriginalMeta): LobbyCatalogGame {
  return {
    ...game,
    slug: original.id,
    name: original.name,
    provider: ORIGINAL_PROVIDER,
    category: "originals",
    imageUrl: original.image,
    thumbnailUrl: original.image,
    rtp: original.rtp * 100,
    volatility: original.volatility,
    description: original.description,
    gameType: "original",
    minBet: original.minBet ?? game.minBet,
    maxBet: original.maxBet ?? game.maxBet,
    featured: original.featured ?? game.featured,
    isNew: original.isNew ?? game.isNew,
  };
}

/** Decide whether a missing canonical entry belongs in this filtered response. */
function originalMatchesQuery(
  original: OriginalMeta,
  category: string | null,
  featured: boolean,
  vendor: string | null,
): boolean {
  if (category && category !== "all" && category !== "originals") return false;
  if (featured && !original.featured) return false;
  if (vendor && vendor.toLocaleLowerCase() !== ORIGINAL_PROVIDER.toLocaleLowerCase()) return false;
  return true;
}

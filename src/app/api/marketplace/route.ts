import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/session";

// GET /api/marketplace?collection=&rarity=&type=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const collection = searchParams.get("collection");
  const rarity = searchParams.get("rarity");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = { status: "active" };
  if (collection) where.collection = collection;
  if (rarity) where.rarity = rarity;
  if (type) where.listingType = type;

  const listings = await db.marketListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return ok(
    listings.map((l) => ({
      id: l.id,
      cardName: l.cardName,
      collection: l.collection,
      rarity: l.rarity,
      insuredValue: l.insuredValue,
      image: l.image,
      listingType: l.listingType,
      price: l.price,
      swapFor: l.swapFor,
      sellerAlias: l.sellerAlias,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
    }))
  );
}

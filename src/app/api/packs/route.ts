import { db } from "@/lib/db";
import { ok } from "@/lib/session";

// GET /api/packs — all card packs
export async function GET() {
  const packs = await db.cardPack.findMany({
    where: { enabled: true },
    orderBy: { price: "asc" },
  });
  return ok(
    packs.map((p) => ({
      id: p.id,
      name: p.name,
      collection: p.collection,
      price: p.price,
      currency: p.currency,
      cardsPerPack: p.cardsPerPack,
      image: p.image,
      description: p.description,
      dropRates: p.dropRates,
    }))
  );
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/cards — current user's collectible cards
export async function GET() {
  const user = await getSession();
  const cards = await db.collectibleCard.findMany({
    where: { userId: user.id },
    orderBy: [{ rarity: "desc" }, { insuredValue: "desc" }],
  });
  return ok(
    cards.map((c) => ({
      id: c.id,
      collection: c.collection,
      cardName: c.cardName,
      rarity: c.rarity,
      insuredValue: c.insuredValue,
      currency: c.currency,
      gradingCompany: c.gradingCompany,
      gradingId: c.gradingId,
      image: c.image,
      packName: c.packName,
      isNew: c.isNew,
    }))
  );
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err, fairFloat } from "@/lib/session";

// GET /api/packs/[id] — open a pack: deduct price, mint random cards
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const { id } = await params;
  const pack = await db.cardPack.findUnique({ where: { id } });
  if (!pack) return err("Pack not found", 404);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet || wallet.balance < pack.price) return err("Insufficient balance", 400);

  // Deduct price
  await db.casinoWallet.update({ where: { userId: user.id }, data: { balance: { decrement: pack.price } } });

  // Determine drop rates
  let rates: Record<string, number> = { common: 60, rare: 25, epic: 10, legendary: 4, mythic: 1 };
  try {
    if (pack.dropRates) rates = JSON.parse(pack.dropRates);
  } catch {}

  const rarities = ["common", "rare", "epic", "legendary", "mythic"];
  const totalWeight = rarities.reduce((s, r) => s + (rates[r] || 0), 0);
  const packSeed = user.id + ":" + pack.id;

  function rollRarity(nonce: number): string {
    const r = fairFloat("tols-pack-server", packSeed, nonce) * totalWeight;
    let acc = 0;
    for (const rar of rarities) {
      acc += rates[rar] || 0;
      if (r <= acc) return rar;
    }
    return "common";
  }

  // Card name pools per collection
  const cardPool: Record<string, { name: string; baseValue: number }[]> = {
    Pokémon: [
      { name: "Pikachu", baseValue: 200 }, { name: "Charizard", baseValue: 400 }, { name: "Blastoise", baseValue: 180 },
      { name: "Venusaur", baseValue: 170 }, { name: "Mewtwo", baseValue: 900 }, { name: "Gengar", baseValue: 150 },
      { name: "Dragonite", baseValue: 250 }, { name: "Lugia", baseValue: 700 }, { name: "Rayquaza", baseValue: 650 },
    ],
    NBA: [
      { name: "LeBron James", baseValue: 300 }, { name: "Stephen Curry", baseValue: 280 }, { name: "Giannis A.", baseValue: 220 },
      { name: "Kevin Durant", baseValue: 240 }, { name: "Luka Doncic", baseValue: 260 }, { name: "Ja Morant", baseValue: 180 },
      { name: "Anthony Edwards", baseValue: 160 }, { name: "Victor Wembanyama", baseValue: 350 },
    ],
    FIFA: [
      { name: "Messi", baseValue: 400 }, { name: "Ronaldo", baseValue: 380 }, { name: "Mbappé", baseValue: 320 },
      { name: "Haaland", baseValue: 300 }, { name: "Vinicius Jr.", baseValue: 240 }, { name: "Bellingham", baseValue: 260 },
      { name: "Pelé Icon", baseValue: 800 }, { name: "Maradona Icon", baseValue: 750 },
    ],
    F1: [
      { name: "Verstappen", baseValue: 280 }, { name: "Hamilton", baseValue: 260 }, { name: "Leclerc", baseValue: 200 },
      { name: "Norris", baseValue: 190 }, { name: "Sainz", baseValue: 170 }, { name: "Russell", baseValue: 160 },
      { name: "Alonso", baseValue: 220 }, { name: "Piastri", baseValue: 140 },
    ],
    UFC: [
      { name: "Jon Jones", baseValue: 240 }, { name: "Islam Makhachev", baseValue: 220 }, { name: "Alex Pereira", baseValue: 200 },
      { name: "Conor McGregor", baseValue: 280 }, { name: "Khamzat Chimaev", baseValue: 180 }, { name: "Ilia Topuria", baseValue: 160 },
      { name: "Sean O'Malley", baseValue: 170 }, { name: "Dustin Poirier", baseValue: 150 },
    ],
    "Yu-Gi-Oh!": [
      { name: "Blue-Eyes White Dragon", baseValue: 300 }, { name: "Dark Magician", baseValue: 280 }, { name: "Exodia", baseValue: 900 },
      { name: "Red-Eyes B. Dragon", baseValue: 220 }, { name: "Slifer the Sky Dragon", baseValue: 650 }, { name: "Obelisk the Tormentor", baseValue: 620 },
      { name: "Winged Dragon of Ra", baseValue: 600 }, { name: "Kuriboh", baseValue: 80 },
    ],
  };

  const pool = cardPool[pack.collection] || cardPool.Pokémon;
  const rarityMult: Record<string, number> = { common: 1, rare: 3, epic: 8, legendary: 20, mythic: 50 };

  const pulled: Array<{ cardName: string; rarity: string; insuredValue: number; image: string }> = [];
  for (let i = 0; i < pack.cardsPerPack; i++) {
    const rarity = rollRarity(i);
    const card = pool[Math.floor(fairFloat("tols-card-server", user.id + ":" + pack.id + ":" + i, pack.cardsPerPack) * pool.length)];
    const insuredValue = Math.round(card.baseValue * rarityMult[rarity]);
    const cardImage = `/cards/${pack.collection.toLowerCase().replace(/[^a-z]/g, "")}-${card.name.toLowerCase().split(" ")[0]}.svg`;
    const pulledCard = await db.collectibleCard.create({
      data: {
        userId: user.id,
        collection: pack.collection,
        cardName: card.name,
        rarity,
        insuredValue,
        currency: "USDT",
        gradingCompany: "PSA",
        gradingId: `PSA-${8 + Math.floor(fairFloat("tols-grade", user.id + pack.id, i) * 3)}`,
        image: cardImage,
        packName: pack.name,
        isNew: true,
      },
    });
    await db.cardPull.create({
      data: {
        userId: user.id,
        collection: pack.collection,
        cardName: card.name,
        rarity,
        packName: pack.name,
        puller: user.username,
        image: cardImage,
      },
    });
    pulled.push({ cardName: card.name, rarity, insuredValue, image: cardImage });
  }

  // Reload balance
  const newWallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });

  return ok({ pulled, newBalance: newWallet?.balance ?? 0, packName: pack.name });
}

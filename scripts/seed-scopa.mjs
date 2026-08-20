// scripts/seed-scopa.mjs
// Idempotently registers "Scopa Siciliana Fast Bet" in the casino game catalog
// so it appears in the Originals rows and launches the ScopaGame player.
//
// The game engine itself lives in src/lib/scopa.ts and the bet server in
// /api/bets (case "scopa") — this script only writes the catalogue row.
//
// Usage:
//   node scripts/seed-scopa.mjs
//
// Re-running updates the existing row (matched on the unique externalId).

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

// Minimal .env loader so DATABASE_URL is picked up without a dotenv dep.
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch {}

const db = new PrismaClient();

const SCOPAS = {
  externalId: "tols-scopa-siciliana",
  name: "Scopa Siciliana",
  alias: "scopa", // must match the GamePlayer switch + page.tsx case
  provider: "TOLS Originals",
  category: "originals",
  gameType: "original",
  imageUrl: "/games/originals/scopa.jpg",
  thumbnailUrl: "/games/originals/scopa.jpg",
  rtp: 96,
  minBet: 0.01,
  maxBet: 100,
  volatility: "medium",
  isLive: false,
  enabled: true,
  featured: true,
  isNew: true,
  popularity: 500,
  priority: 0,
  tags: JSON.stringify(["original", "cards", "scopa", "fast-bet"]),
  description:
    "Fast Bet sulla Scopa Siciliana: due mani virtuali giocano una partita automatica con strategia fissa e pubblica. Scommetti su 1/X/2, Over/Under 4.5, Settebello o Scope. Provably fair con seed commit-reveal.",
};

async function main() {
  const game = await db.casinoGame.upsert({
    where: { externalId: SCOPAS.externalId },
    update: { ...SCOPAS },
    create: { ...SCOPAS },
  });

  console.log("Scopa Siciliana Fast Bet registered:");
  console.log("  id:         " + game.id);
  console.log("  externalId: " + game.externalId);
  console.log("  alias:      " + game.alias);
  console.log("  category:   " + game.category);
  console.log("  gameType:   " + game.gameType);
  console.log("  enabled:    " + game.enabled);
  console.log("");
  console.log("It will now appear in the Originals rows of the casino lobby.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

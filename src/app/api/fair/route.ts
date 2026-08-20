import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { getActiveSeed, rotateSeed, setClientSeed, hashServerSeed, fairFloat, fairInt } from "@/lib/provably-fair";
import { playScopaRound, resolveScopaMarket, SCOPA_ODDS, type ScopaMarket } from "@/lib/scopa";
import { getEngine } from "@/lib/game-engines";
import { poolRushCount } from "@/lib/game-engines/instant";
import { KENO_POOL, KENO_DRAWS, MINES_TILES } from "@/shared/constants";
import { db } from "@/lib/db";

// GET /api/fair — the player's current commitment. The server seed itself is
// withheld until the pair is rotated; its SHA-256 is published now so a later
// reveal can be checked against it.
export async function GET() {
  const user = await getSession();
  const seed = await getActiveSeed(user.id);
  const revealed = await db.fairSeed.findMany({
    where: { userId: user.id, revealedAt: { not: null } },
    orderBy: { revealedAt: "desc" },
    take: 10,
    select: { serverSeed: true, serverSeedHash: true, clientSeed: true, nonce: true, revealedAt: true },
  });
  return ok({
    active: { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce: seed.nonce },
    revealed,
    howToVerify:
      "outcome = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`); " +
      "first 13 hex chars / 0x10000000000000 gives the float. " +
      "Check SHA256(serverSeed) equals the hash you were shown before betting.",
  });
}

// POST /api/fair — { clientSeed } to set a seed, or { rotate: true } to retire
// the pair and reveal its server seed.
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  if (body.rotate === true) return ok(await rotateSeed(user.id));

  const clientSeed = String(body.clientSeed ?? "").trim();
  if (!clientSeed) return err("clientSeed is required", 400);
  const updated = await setClientSeed(user.id, clientSeed);
  return ok({ clientSeed: updated.clientSeed, nonce: updated.nonce });
}

// PUT /api/fair — recompute an outcome from a revealed seed, so a player can
// confirm a past bet without trusting this server's arithmetic.
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { serverSeed, clientSeed, nonce, cursor, game, market } = body ?? {};
  if (!serverSeed || !clientSeed || nonce === undefined) {
    return err("serverSeed, clientSeed and nonce are required", 400);
  }
  const s = String(serverSeed);
  const c = String(clientSeed);
  const n = Number(nonce);

  const out: Record<string, unknown> = {
    serverSeedHash: hashServerSeed(s),
    float: fairFloat(s, c, n, Number(cursor ?? 0)),
  };

  // Full-game replay for an Originals engine: recompute the outcome from the
  // revealed seed. `legacyOutcome` is the same game re-derived with the old
  // float-scaled integer mapping, so bets placed before the bias-free switch
  // still verify — the player compares whichever matches the bet they made.
  const engine = typeof game === "string" ? getEngine(game) : null;
  if (engine && engine.generateOutcome) {
    const params = (body.params ?? {}) as Record<string, unknown>;
    out.outcome = engine.generateOutcome(s, c, n, params);
    if (game === "scopa") {
      const r = playScopaRound((cur) => fairFloat(s, c, n, cur));
      out.scopa = {
        outcome: r.outcome,
        deck: r.deck,
        timeline: r.timeline,
        playerCardsCount: r.playerCards.length,
        bankCardsCount: r.bankCards.length,
        playerPoints: r.playerPoints,
        bankPoints: r.bankPoints,
        totalPoints: r.totalPoints,
        playerScopa: r.playerScopa,
        bankScopa: r.bankScopa,
        playerSevenOfCoins: r.playerSevenOfCoins,
        bankSevenOfCoins: r.bankSevenOfCoins,
        playerCoins: r.playerCoins,
        bankCoins: r.bankCoins,
        playerPrimiera: r.playerPrimiera,
        bankPrimiera: r.bankPrimiera,
      };
      if (market) {
        const m = String(market);
        if (m in SCOPA_ODDS) {
          const marketId = m as ScopaMarket;
          out.market = {
            id: marketId,
            won: resolveScopaMarket(marketId, r),
            odds: SCOPA_ODDS[marketId],
          };
        }
      }
    } else {
      const legacy = replayLegacyOutcome(game as string, s, c, n, params);
      if (legacy) out.legacyOutcome = legacy;
    }
  }

  return ok(out);
}

/**
 * Legacy integer derivation (pre-bias-free-switch) for games that mapped
 * bounded ranges with `Math.floor(fairFloat(...) * n)`. Returns null for
 * games that never used integer mapping (their outcome is identical under
 * both derivations).
 */
function replayLegacyOutcome(game: string, s: string, c: string, n: number, params: Record<string, unknown>): Record<string, unknown> | null {
  switch (game) {
    case "wheel": {
      const segments = Math.max(2, Number(params.segments ?? 20));
      return { segment: fairInt(s, c, n, segments), segments };
    }
    case "roulette": {
      return { winning: fairInt(s, c, n, 37) };
    }
    case "keno": {
      return { drawn: legacyKenoDraws(s, c, n) };
    }
    case "mines": {
      const mines = Math.min(24, Math.max(1, Number(params.mines ?? 3)));
      return { layout: legacyMinesLayout(s, c, n, mines), mines };
    }
    case "blackjack": {
      return { shoe: legacyShoe(s, c, n).slice(0, 8) };
    }
    case "pool-rush": {
      const r = fairFloat(s, c, n);
      return legacyPoolRush(s, c, n, r);
    }
    default:
      return null;
  }
}

/* ── legacy replay helpers (exact mirror of the old float-scaled formulas) ── */

function legacyKenoDraws(s: string, c: string, n: number): number[] {
  const pool = Array.from({ length: KENO_POOL }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = fairInt(s, c + ":k" + i, n, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, KENO_DRAWS);
}

function legacyMinesLayout(s: string, c: string, n: number, mines: number): boolean[] {
  const arr = new Array(MINES_TILES).fill(false);
  const indices = Array.from({ length: MINES_TILES }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = fairInt(s, c, n, i + 1, i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let k = 0; k < mines; k++) arr[indices[k]] = true;
  return arr;
}

function legacyShoe(s: string, c: string, n: number): Array<{ r: number; s: number }> {
  const deck: Array<{ r: number; s: number }> = [];
  for (let suit = 0; suit < 4; suit++) for (let r = 1; r <= 13; r++) deck.push({ r, s: suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = fairInt(s, c, n, i + 1, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function legacyPoolRush(s: string, c: string, n: number, r: number): Record<string, unknown> {
  const count = poolRushCount(r);
  const order = Array.from({ length: 8 }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = fairInt(s, c, n, i + 1, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const pocketed = order.slice(0, count);
  const pockets = pocketed.map((_, i) => fairInt(s, c, n, 6, 20 + i));
  return { roll: Math.floor(r * 10000) / 100, count, pocketed, pockets };
}

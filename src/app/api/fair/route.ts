import { NextRequest } from "next/server";
import { getSession, ok, err } from "@/lib/session";
import { getActiveSeed, rotateSeed, setClientSeed, hashServerSeed, fairFloat } from "@/lib/provably-fair";
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
  const { serverSeed, clientSeed, nonce, cursor } = body ?? {};
  if (!serverSeed || !clientSeed || nonce === undefined) {
    return err("serverSeed, clientSeed and nonce are required", 400);
  }
  return ok({
    serverSeedHash: hashServerSeed(String(serverSeed)),
    float: fairFloat(String(serverSeed), String(clientSeed), Number(nonce), Number(cursor ?? 0)),
  });
}

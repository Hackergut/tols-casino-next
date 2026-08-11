import { createHash, createHmac, randomBytes } from "crypto";
import { db } from "@/lib/db";

/*
 * Provably-fair engine (server only).
 *
 * What was here before could not support the claim on the tin: outcomes came
 * from a non-cryptographic 32-bit mixing function, the "commitment" hash used
 * that same reversible function, seeds were produced by Math.random() — which
 * is predictable and must never decide money — and the server seed was thrown
 * away after each bet, so no player could ever check a past result.
 *
 * This is the industry construction:
 *   serverSeed  32 random bytes from a CSPRNG, kept secret while in play
 *   commitment  SHA-256(serverSeed), published before any bet is placed
 *   clientSeed  chosen by the player, changeable at any time
 *   nonce       increments per bet, so every roll is a distinct input
 *   outcome     HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
 *
 * Rotating the seed reveals the old serverSeed, letting anyone recompute every
 * outcome it produced and confirm it hashes to the commitment they were shown.
 */

export interface ActiveSeed {
  id: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/** SHA-256 commitment a player can check the revealed seed against. */
export function hashServerSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/** Cryptographically secure server seed. */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Deterministic float in [0,1) for one roll. `cursor` yields extra independent
 * values for the same bet (Plinko needs one per row, Keno one per draw).
 */
export function fairFloat(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
  const hmac = createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest("hex");
  // Take 52 bits — the full precision of a double — so the value is uniform.
  const slice = hmac.slice(0, 13);
  return parseInt(slice, 16) / 0x10000000000000;
}

/** Integer in [0, max) from the same stream. */
export function fairInt(serverSeed: string, clientSeed: string, nonce: number, max: number, cursor = 0): number {
  return Math.floor(fairFloat(serverSeed, clientSeed, nonce, cursor) * max);
}

/**
 * The player's active seed pair, created on first use. The commitment is
 * public; the server seed itself is only returned once the pair is retired.
 */
export async function getActiveSeed(userId: string): Promise<ActiveSeed & { serverSeed: string }> {
  const existing = await db.fairSeed.findFirst({
    where: { userId, revealedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const serverSeed = generateServerSeed();
  return db.fairSeed.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: randomBytes(8).toString("hex"),
      nonce: 0,
    },
  });
}

/** Consume the next nonce for a bet. Returns the seed state used for it. */
export async function nextNonce(seedId: string): Promise<number> {
  const updated = await db.fairSeed.update({
    where: { id: seedId },
    data: { nonce: { increment: 1 } },
    select: { nonce: true },
  });
  return updated.nonce;
}

/** Player-chosen client seed. Takes effect from the next bet. */
export async function setClientSeed(userId: string, clientSeed: string): Promise<ActiveSeed> {
  const seed = await getActiveSeed(userId);
  return db.fairSeed.update({
    where: { id: seed.id },
    data: { clientSeed: clientSeed.slice(0, 64) },
  });
}

/**
 * Retire the active pair and open a new one. The retired server seed is
 * returned so every bet made under it can now be verified independently.
 */
export async function rotateSeed(userId: string): Promise<{ revealed: { serverSeed: string; serverSeedHash: string; nonce: number }; next: { serverSeedHash: string; clientSeed: string } }> {
  const current = await getActiveSeed(userId);
  await db.fairSeed.update({
    where: { id: current.id },
    data: { revealedAt: new Date() },
  });

  const serverSeed = generateServerSeed();
  const next = await db.fairSeed.create({
    data: {
      userId,
      serverSeed,
      serverSeedHash: hashServerSeed(serverSeed),
      clientSeed: current.clientSeed,
      nonce: 0,
    },
  });

  return {
    revealed: {
      serverSeed: current.serverSeed,
      serverSeedHash: current.serverSeedHash,
      nonce: current.nonce,
    },
    next: { serverSeedHash: next.serverSeedHash, clientSeed: next.clientSeed },
  };
}

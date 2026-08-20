import { createHash, createHmac, randomBytes } from "crypto";

/*
 * Provably-fair crypto core — pure functions, no I/O.
 *
 * Kept free of any database import so the exact same code can be loaded by
 * node tests, edge workers and the server alike (freeze canonical
 * serialization and test vectors before anything cross-language).
 *
 *   serverSeed  32 random bytes from a CSPRNG, kept secret while in play
 *   commitment  SHA-256(serverSeed), published before any bet is placed
 *   clientSeed  chosen by the player, changeable at any time
 *   nonce       increments per bet, so every roll is a distinct input
 *   outcome     HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
 *
 * Integer mapping is bias-free: bounded ranges use rejection sampling over
 * 32-bit chunks of the HMAC stream (namespace `…:u32`), never `floor(x*n)`
 * over a non-divisible modulus.
 */

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

/**
 * Integer in [0, max) — legacy float-scaled mapping.
 *
 * Kept for historical replay: bets placed before the bias-free mapping was
 * introduced derive their integers this way, and the verifier still accepts
 * them. New bets must use `fairIntUnbiased`.
 */
export function fairInt(serverSeed: string, clientSeed: string, nonce: number, max: number, cursor = 0): number {
  return Math.floor(fairFloat(serverSeed, clientSeed, nonce, cursor) * max);
}

/**
 * Integer in [0, max) with ZERO modulo bias — rejection sampling.
 *
 * `floor(x * max)` over a 2^52 grid is biased when max does not divide 2^52
 * (a wheel with 37 segments is measurably non-uniform at scale). Here a
 * 32-bit word from the HMAC stream is accepted only while it falls below the
 * largest multiple of max, so every outcome is exactly equiprobable. The
 * input namespace (`…:u32`) is disjoint from the float stream, so the two
 * derivations can never collide.
 *
 * Retries are bounded: 32 samples is astronomically beyond the probability of
 * needing more than a handful for any realistic max.
 */
export function fairIntUnbiased(serverSeed: string, clientSeed: string, nonce: number, max: number, cursor = 0): number {
  if (max <= 1) return 0;
  const LIMIT = 0x100000000; // 2^32
  // Rejection threshold: the largest multiple of max below 2^32.
  const threshold = LIMIT - (LIMIT % max);
  for (let i = 0; i < 32; i++) {
    const hmac = createHmac("sha256", serverSeed)
      .update(`${clientSeed}:${nonce}:${cursor}:u32:${i}`)
      .digest("hex");
    const word = parseInt(hmac.slice(0, 8), 16);
    if (word < threshold) return word % max;
  }
  // Practically unreachable; fall back to a full-width word.
  const hmac = createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}:u32:fallback`)
    .digest("hex");
  return parseInt(hmac.slice(0, 8), 16) % max;
}

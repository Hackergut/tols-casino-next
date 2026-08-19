/**
 * Isomorphic provably-fair helpers.
 * Server uses Node crypto (sync) via src/lib/provably-fair.ts.
 * This module is the browser-safe verifier: Web Crypto HMAC-SHA256,
 * matching the server construction exactly.
 *
 *   HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`)
 *   first 13 hex chars / 0x10000000000000 → float in [0, 1)
 */

export function floatFromHmacHex(hex: string): number {
  const slice = hex.slice(0, 13);
  return parseInt(slice, 16) / 0x10000000000000;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function fairFloat(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  cursor = 0,
): Promise<number> {
  const hmac = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}:${cursor}`);
  return floatFromHmacHex(hmac);
}

export async function hashServerSeed(serverSeed: string): Promise<string> {
  return sha256Hex(serverSeed);
}

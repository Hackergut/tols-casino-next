import { createVerify, createPublicKey } from "node:crypto";

/**
 * Platform JWT — RS256 only (Governance Tower → Casino)
 *
 * The Tower signs with the PRIVATE KEY, the Casino verifies with the PUBLIC KEY.
 * This removes the mocks: governance shows real data only when the JWT is valid.
 *
 * Env on Casino (Vercel tols-casino-next):
 *   PLATFORM_JWT_PUBLIC_KEY  — public PEM (-----BEGIN PUBLIC KEY-----...) or base64 of the PEM
 *   PLATFORM_JWT_ISSUER      — default "tols-governance"
 *   PLATFORM_JWT_AUDIENCE    — default "tols-casino"
 *
 * Env on Tower (Vercel governance-tower):
 *   PLATFORM_JWT_PRIVATE_KEY — private PEM (-----BEGIN PRIVATE KEY-----...) or base64 of the PEM
 */

function normalizePem(raw: string | undefined, kind: "public" | "private"): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // If it is the base64 of a PEM (Vercel env vars are often newline-less), decode it.
  if (!trimmed.includes("-----BEGIN")) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      if (decoded.includes("-----BEGIN")) return decoded;
    } catch {}
    // Otherwise try it without base64 but with escaped \n.
    return trimmed.replace(/\\n/g, "\n");
  }
  return trimmed.replace(/\\n/g, "\n");
}

function getPublicKeyPem(): string | null {
  return normalizePem(process.env.PLATFORM_JWT_PUBLIC_KEY, "public");
}
function getExpectedIssuer(): string {
  return (process.env.PLATFORM_JWT_ISSUER || "tols-governance").trim();
}
function getExpectedAudience(): string {
  return (process.env.PLATFORM_JWT_AUDIENCE || "tols-casino").trim();
}

export interface PlatformJwtClaims {
  iss: string;
  aud: string;
  sub?: string;       // tower service id
  iat: number;
  exp: number;
  jti?: string;
  role?: string;      // "platform" | "governance"
  scope?: string[];   // ["deposits:read","withdrawals:write",...]
}

function base64urlDecode(input: string): Buffer {
  // Node supports base64url directly
  return Buffer.from(input, "base64url");
}

export interface VerifyResult {
  valid: boolean;
  claims?: PlatformJwtClaims;
  error?: string;
  rawHeader?: Record<string, unknown>;
}

/**
 * Verify an RS256 JWT. Returns the claims if valid, otherwise an error.
 * - Checks the RS256 signature with the PUBLIC KEY
 * - Checks exp (not expired), iss, aud
 */
export function verifyPlatformJwt(token: string | null | undefined): VerifyResult {
  if (!token) return { valid: false, error: "Missing Authorization Bearer token" };
  const raw = token.trim().replace(/^Bearer\s+/i, "");
  if (!raw) return { valid: false, error: "Empty token" };

  const pubPem = getPublicKeyPem();
  if (!pubPem) return { valid: false, error: "PLATFORM_JWT_PUBLIC_KEY not configured on Casino" };

  const parts = raw.split(".");
  if (parts.length !== 3) return { valid: false, error: "Invalid JWT format" };
  const [hB64, pB64, sigB64] = parts;

  let header: Record<string, unknown>;
  let payload: PlatformJwtClaims;
  try {
    header = JSON.parse(base64urlDecode(hB64).toString("utf8"));
    payload = JSON.parse(base64urlDecode(pB64).toString("utf8"));
  } catch {
    return { valid: false, error: "Invalid JWT encoding" };
  }

  if (header.alg !== "RS256") return { valid: false, error: `Invalid alg ${String(header.alg)} — expected RS256` };
  if (header.typ && String(header.typ).toUpperCase() !== "JWT") {
    // tolerant
  }

  // Verify signature
  try {
    const data = `${hB64}.${pB64}`;
    const sig = base64urlDecode(sigB64);
    const key = createPublicKey(pubPem);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(data);
    verifier.end();
    const ok = verifier.verify(key, sig);
    if (!ok) return { valid: false, error: "Invalid signature" };
  } catch (e) {
    return { valid: false, error: `Signature verify failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Check exp / nbf / iss / aud
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < nowSec) {
    return { valid: false, error: "Token expired", rawHeader: header };
  }
  if (typeof payload.iat === "number" && payload.iat > nowSec + 60) {
    return { valid: false, error: "Token iat in future", rawHeader: header };
  }
  const iss = getExpectedIssuer();
  if (payload.iss !== iss) return { valid: false, error: `Invalid iss expected ${iss}`, rawHeader: header };
  const aud = getExpectedAudience();
  if (payload.aud !== aud) return { valid: false, error: `Invalid aud expected ${aud}`, rawHeader: header };

  return { valid: true, claims: payload, rawHeader: header };
}

/**
 * Helper to extract the Bearer token from a Request.
 */
export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Create an RS256 JWT (test-only on Casino; production signs on the Tower).
 * Requires the PLATFORM_JWT_PRIVATE_KEY env var.
 */
export function signPlatformJwtForTest(claims: Partial<PlatformJwtClaims> & { sub?: string }, expiresInSec = 600): string {
  const { createSign, createPrivateKey } = require("node:crypto") as typeof import("node:crypto");
  const rawPriv = process.env.PLATFORM_JWT_PRIVATE_KEY;
  const pem = normalizePem(rawPriv, "private");
  if (!pem) throw new Error("PLATFORM_JWT_PRIVATE_KEY not configured");
  const now = Math.floor(Date.now() / 1000);
  const payload: PlatformJwtClaims = {
    iss: claims.iss || getExpectedIssuer(),
    aud: claims.aud || getExpectedAudience(),
    sub: claims.sub || "tower-test",
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + expiresInSec,
    role: claims.role || "platform",
    scope: claims.scope || ["deposits:read", "withdrawals:read", "withdrawals:write", "payments:read"],
    ...claims,
  } as PlatformJwtClaims;
  const header = { alg: "RS256", typ: "JWT" };
  const hB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const pB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const data = `${hB64}.${pB64}`;
  const key = createPrivateKey(pem);
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const sig = signer.sign(key);
  const sB64 = (sig as Buffer).toString("base64url");
  return `${data}.${sB64}`;
}

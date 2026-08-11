import { headers } from "next/headers";

/*
 * Fixed-window rate limiting.
 *
 * Nothing here was throttled: sign-in could be brute-forced, and the bet
 * endpoint could be hammered to farm outcomes or grind the database.
 *
 * State is per-process and in memory, which is the honest limitation — with
 * more than one instance each gets its own budget, so this raises the cost of
 * abuse but is not a distributed guarantee. Moving the counters to Redis is
 * the drop-in upgrade when the platform runs on more than one node.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Keep the map from growing without bound on a long-lived server.
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export interface Limit {
  /** Requests allowed inside the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const LIMITS = {
  /** Sign-in: slow enough that guessing a password is impractical. */
  auth: { max: 8, windowMs: 60_000 },
  /** Betting: generous for real play, tight enough to stop scripted farming. */
  bet: { max: 120, windowMs: 60_000 },
  /** Money movement deserves a much smaller budget. */
  money: { max: 10, windowMs: 60_000 },
  /** Everything else. */
  general: { max: 300, windowMs: 60_000 },
} satisfies Record<string, Limit>;

/** Caller identity: the client IP as reported by the proxy, else a fallback. */
async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(scope: string, limit: Limit): Promise<RateResult> {
  const now = Date.now();
  sweep(now);

  const key = `${scope}:${await clientKey()}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { allowed: true, remaining: limit.max - 1, retryAfterSeconds: 0 };
  }

  bucket.count++;
  if (bucket.count > limit.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit.max - bucket.count, retryAfterSeconds: 0 };
}

/**
 * Guard helper: returns a 429 Response when the caller is over budget, so a
 * route can `if (limited) return limited;` and carry on otherwise.
 */
export async function rateLimit(scope: string, limit: Limit): Promise<Response | null> {
  const r = await checkRateLimit(scope, limit);
  if (r.allowed) return null;
  return Response.json(
    { success: false, error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } },
  );
}

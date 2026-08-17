import { createHmac, timingSafeEqual } from "crypto";

/*
 * TOLSGOVERNZ bridge — the casino side.
 *
 * The casino is the source of truth for money; tolsgovernz is the governance
 * plane that OBSERVES play and can GATE it. Two directions, one shared secret
 * (GOV_BRIDGE_SECRET, >= 32 chars, fail-closed when absent):
 *
 *   1. OUTBOUND  — after every settled bet, emitGovBet() POSTs the event to
 *      `${GOV_URL}/api/casino-bridge/events`. Fire-and-forget via `after()` in
 *      the route: the player NEVER waits on gov, and a gov outage never blocks
 *      or loses money movement (the bet is already settled and ledgered here).
 *
 *   2. INBOUND   — before a bet is accepted, checkGovPolicy() asks
 *      `${GOV_URL}/api/casino-bridge/policy` whether the player may play
 *      (suspended / self-excluded / loss limit). The answer is cached per-user
 *      for POLICY_CACHE_MS so clicks stay fluid; on timeout or error the call
 *      FAILS OPEN (allow) — governance is a brake, not a single point of
 *      failure for the game loop.
 *
 * Signing: HMAC-SHA256 hex over the exact raw JSON body, sent as X-Signature —
 * the same scheme as the vendor seamless wallet (src/lib/vendor-wallet.ts), so
 * both integrations verify identically.
 */

const GOV_URL = (process.env.GOV_URL || "https://tolsgovernz.vercel.app").replace(/\/+$/, "");
const SECRET = process.env.GOV_BRIDGE_SECRET || "";

/** Policy answers are cached briefly so rapid play adds no per-bet latency. */
const POLICY_CACHE_MS = 30_000;
/** Hard cap on how long a policy call may take before we fail open. */
const POLICY_TIMEOUT_MS = 350;
/** Event posts get a little longer — they're off the critical path. */
const EVENT_TIMEOUT_MS = 3_000;

export function govBridgeConfigured(): boolean {
  return SECRET.length >= 32 && Boolean(process.env.GOV_URL ?? true);
}

export function signGovBody(rawBody: string): string {
  return createHmac("sha256", SECRET).update(rawBody).digest("hex");
}

export function verifyGovSignature(rawBody: string, provided: string | null): boolean {
  if (!provided || SECRET.length < 32) return false;
  const expected = signGovBody(rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Policy check (gov → casino gate) ─────────────────────────────────────────

export type GovPolicyAction =
  | "allow"
  | "block:suspended"
  | "block:self_excluded"
  | "block:loss_limit"
  | "block:stake_limit";

export interface GovPolicy {
  action: GovPolicyAction;
  /** Max stake allowed right now, when action is allow or block:stake_limit. */
  maxStake?: number;
  /** Human-readable reason for the block, safe to show the player. */
  reason?: string;
}

interface CacheEntry {
  policy: GovPolicy;
  expiresAt: number;
}

const policyCache = new Map<string, CacheEntry>();

// Keep the map bounded on a long-lived server.
function sweepPolicyCache(now: number): void {
  if (policyCache.size < 10_000) return;
  for (const [k, v] of policyCache) if (v.expiresAt <= now) policyCache.delete(k);
}

const ALLOW: GovPolicy = { action: "allow" };

/**
 * Ask gov whether this player may place a bet of `stake` right now.
 * Fails OPEN: unreachable/slow/misconfigured gov returns allow, so governance
 * can never freeze the casino. Blocks are real blocks — cached for 30s.
 */
export async function checkGovPolicy(userId: string, username: string, stake: number): Promise<GovPolicy> {
  if (SECRET.length < 32) return ALLOW;

  const now = Date.now();
  sweepPolicyCache(now);
  const cached = policyCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return stakeOk(cached.policy, stake);
  }

  const body = JSON.stringify({ playerExternalId: userId, username, stake });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), POLICY_TIMEOUT_MS);
  try {
    const res = await fetch(`${GOV_URL}/api/casino-bridge/policy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signGovBody(body),
      },
      body,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return ALLOW;
    const j = (await res.json().catch(() => null)) as { policy?: GovPolicy } | null;
    const policy = j?.policy && typeof j.policy.action === "string" ? j.policy : ALLOW;
    policyCache.set(userId, { policy, expiresAt: now + POLICY_CACHE_MS });
    return stakeOk(policy, stake);
  } catch {
    return ALLOW; // timeout / network — fail open, never block the game loop
  } finally {
    clearTimeout(t);
  }
}

/** A cached "allow" can still carry a maxStake cap; re-check it per bet. */
function stakeOk(policy: GovPolicy, stake: number): GovPolicy {
  if (policy.action === "allow" && typeof policy.maxStake === "number" && stake > policy.maxStake) {
    return {
      action: "block:stake_limit",
      maxStake: policy.maxStake,
      reason: `Stake above your current limit (${policy.maxStake})`,
    };
  }
  return policy;
}

// ── Bet event emission (casino → gov feed) ───────────────────────────────────

export interface GovBetEvent {
  kind: "bet.settled";
  /** Idempotency key — gov upserts on this, so a replay never double-counts. */
  betId: string;
  playerExternalId: string;
  username: string;
  game: string;
  stake: number;
  payout: number;
  multiplier: number;
  won: boolean;
  /** stake - payout: positive = house profit, negative = player profit. */
  houseProfit: number;
  balanceAfter: number;
  currency: string;
  /** Set when an internal outcome-control rule overrode the fair result. */
  controlApplied: string | null;
  settledAt: string; // ISO
}

/**
 * POST one settled bet to gov. Fire-and-forget by design — callers use
 * `after(() => emitGovBet(...))` so the response is already sent. All errors
 * are swallowed: the bet is settled and ledgered in the casino DB, and gov's
 * absence must not surface to the player.
 */
export async function emitGovBet(event: GovBetEvent): Promise<void> {
  if (SECRET.length < 32) return;
  const body = JSON.stringify(event);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), EVENT_TIMEOUT_MS);
  try {
    await fetch(`${GOV_URL}/api/casino-bridge/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signGovBody(body),
      },
      body,
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    // Intentionally silent — gov is an observer. A missed event is a reporting
    // gap, not a money error; the casino ledger (CasinoBet/HouseEarning) is
    // authoritative and can be backfilled.
  } finally {
    clearTimeout(t);
  }
}

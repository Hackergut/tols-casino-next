import { createHmac, timingSafeEqual } from "crypto";

/**
 * TOLS Casino ↔ Governance — Project-to-Project Bridge (hackguts-projects)
 *
 *   - Casino      → Vercel hackguts-projects/tols-casino-next → https://vercel.com/hackguts-projects/tols-casino-next
 *                   domains: copy from Vercel → Settings → Domains (e.g. tols.fun or tols-casino-next.vercel.app)
 *   - Governance  → Vercel hackguts-projects/tolsgovernz       → https://vercel.com/hackguts-projects/tolsgovernz
 *                   domains: copy from Vercel → Settings → Domains (e.g. tolsgovernz.vercel.app)
 *
 * The bridge is NOT via the admin panel — it is service-to-service over HTTPS + HMAC/JWT between the two projects.
 *
 * Flow:
 *   Casino → Governance: health, sync, real deposits/withdrawals via /api/platform/* (JWT RS256)
 *   Governance → Casino: commands via /api/bridge/webhook (HMAC)
 *   SSO: 10-minute HMAC token
 *
 * Env on BOTH projects (same secret):
 *   GOVERNANCE_TOWER_URL  — Governance origin, e.g. https://gov.tols.fun (alias: TOWER_URL) — copy from Vercel → tolsgovernz → Domains
 *   APP_URL               — Casino origin, e.g. https://www.tols.fun (alias: CASINO_URL) — copy from Vercel → tols-casino-next → Domains
 *   GOVERNANCE_BRIDGE_SECRET / GOVERNANCE_WEBHOOK_SECRET — shared HMAC (openssl rand -hex 32)
 *   PLATFORM_JWT_*        — JWT RS256: PRIVATE on tolsgovernz, PUBLIC on tols-casino-next (see .env.bridge-keys)
 *
 * Governance is ALWAYS the Vercel project `hackguts-projects/tolsgovernz`
 * at https://gov.tols.fun. It was never Base44.
 */

// ── Config ───────────────────────────────────────────────────────────────

export interface BridgeConfig {
  towerOrigin: string;        // e.g. https://gov.tols.fun
  towerApiBase: string;       // e.g. https://gov.tols.fun/api
  casinoOrigin: string;       // e.g. https://www.tols.fun
  hasBridgeSecret: boolean;
  hasTowerKeys: boolean;
  hasDb: boolean;
}

function stripTrailingSlash(s: string) { return s.replace(/\/+$/, ""); }

function pickEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

/** Governance is gov.tols.fun (Vercel project tolsgovernz). Never Base44. */
export function isGovernanceTowerHost(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host.endsWith("base44.app")) return false;
    return host === "gov.tols.fun" || host.includes("tolsgovernz");
  } catch {
    return false;
  }
}

export function getBridgeConfig(): BridgeConfig {
  const rawTowerOrigin = pickEnv("GOVERNANCE_TOWER_URL", "TOWER_URL");
  const explicitApiBase = pickEnv("TOWER_API_BASE");

  let towerOrigin = "https://gov.tols.fun";
  if (rawTowerOrigin && isGovernanceTowerHost(rawTowerOrigin)) {
    towerOrigin = stripTrailingSlash(rawTowerOrigin);
  }
  const towerApiBase = stripTrailingSlash(
    explicitApiBase && isGovernanceTowerHost(explicitApiBase)
      ? explicitApiBase
      : `${towerOrigin}/api`,
  );

  const casinoOrigin = stripTrailingSlash(pickEnv("APP_URL", "CASINO_URL", "NEXT_PUBLIC_APP_URL") || "https://www.tols.fun");
  const secret = pickEnv("GOVERNANCE_BRIDGE_SECRET", "GOVERNANCE_WEBHOOK_SECRET") || "";
  const hasTowerKeys = Boolean(process.env.TOLS_API_KEY && process.env.TOLS_APP_KEY);

  return {
    towerOrigin,
    towerApiBase,
    casinoOrigin,
    hasBridgeSecret: secret.length >= 16,
    hasTowerKeys,
    hasDb: Boolean(process.env.DATABASE_URL),
  };
}

// ── HMAC helpers ─────────────────────────────────────────────────────────

function bridgeSecret(): string {
  return (pickEnv("GOVERNANCE_BRIDGE_SECRET", "GOVERNANCE_WEBHOOK_SECRET") || "").trim();
}

export function signBridgePayload(payload: string, secretOverride?: string): string {
  const secret = secretOverride || bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured — set the same secret on Casino and Tower (Vercel → Settings → Environment Variables)");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function signBridgeBody(body: unknown): string {
  return signBridgePayload(typeof body === "string" ? body : JSON.stringify(body));
}

export function verifyBridgeSignature(rawBody: string, signature: string | null, secretOverride?: string): boolean {
  const secret = secretOverride || bridgeSecret();
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase().replace(/^sha256=/, ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Verify with the encrypted DB connection first, then environment fallback. */
export async function verifyRuntimeBridgeSignature(rawBody: string, signature: string | null): Promise<boolean> {
  try {
    const { getGovernanceConnection } = await import("@/lib/governance-connection");
    const connection = await getGovernanceConnection();
    if (connection?.enabled && connection.bridgeSecret) return verifyBridgeSignature(rawBody, signature, connection.bridgeSecret);
  } catch { /* env-only deployments remain supported */ }
  return verifyBridgeSignature(rawBody, signature);
}

// ── Outbound helper (Casino → Tower) ────────────────────────────────────
// Works across subdomains too: it calls the other Vercel project directly over HTTPS.

export interface BridgeFetchOpts {
  path?: string;              // appended to towerApiBase, e.g. "/health" or "/bridge/webhook"
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  // When true, use towerOrigin instead of towerApiBase (useful when the Tower has no /api)
  useOrigin?: boolean;
}

/** DB-saved connection, only if it points at real Governance (gov.tols.fun / tolsgovernz). */
export async function loadActiveGovernanceConnection() {
  try {
    const { getGovernanceConnection } = await import("@/lib/governance-connection");
    const stored = await getGovernanceConnection();
    if (!stored?.enabled) return null;
    if (!isGovernanceTowerHost(stored.towerOrigin)) return null;
    return stored;
  } catch {
    return null;
  }
}

export async function bridgeFetch(opts: BridgeFetchOpts = {}): Promise<Response> {
  const envConfig = getBridgeConfig();
  const stored = await loadActiveGovernanceConnection();
  const towerApiBase = stored?.towerApiBase || envConfig.towerApiBase;
  const towerOrigin = stored?.towerOrigin || envConfig.towerOrigin;
  const casinoOrigin = stored?.casinoOrigin || envConfig.casinoOrigin;
  const base = opts.useOrigin ? towerOrigin : towerApiBase;
  const apiKey = stored?.apiKey || process.env.TOLS_API_KEY || "";
  const appKey = stored?.appKey || process.env.TOLS_APP_KEY || "";
  const path = opts.path || "";
  const url = path ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Bridge-Source": "tols-casino",
    "X-Casino-Origin": casinoOrigin,
    ...(opts.headers || {}),
  };
  if (apiKey) { headers["x-api-key"] = apiKey; headers["api_key"] = apiKey; }
  if (appKey) { headers["x-app-key"] = appKey; headers["app_key"] = appKey; }

  const runtimeSecret = stored?.bridgeSecret || bridgeSecret();
  if (runtimeSecret && opts.body !== undefined) {
    const raw = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
    headers["x-bridge-signature"] = `sha256=${signBridgePayload(raw, runtimeSecret)}`;
    headers["x-bridge-timestamp"] = String(Math.floor(Date.now() / 1000));
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

  try {
    return await fetch(url, {
      method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

export interface GovernanceProbe {
  reachable: boolean;
  status?: number;
  latencyMs: number;
  error?: string;
  url?: string;
}

/**
 * Hit the real Governance health endpoints on the Tower origin.
 * HTTP 401/403 still counts as reachable — the host answered.
 */
export async function probeGovernanceHealth(timeoutMs = 4000): Promise<GovernanceProbe> {
  const stored = await loadActiveGovernanceConnection();
  const storedHealth = stored?.healthPath || null;

  const paths = storedHealth
    ? [storedHealth]
    : ["/api/platform/health", "/api/health", "/health"];

  let last: GovernanceProbe = { reachable: false, latencyMs: 0, error: "no probe" };
  for (const path of paths) {
    const t0 = Date.now();
    try {
      const res = await bridgeFetch({ path, useOrigin: true, method: "GET", timeoutMs });
      const latencyMs = Date.now() - t0;
      last = { reachable: true, status: res.status, latencyMs, url: path };
      if (res.status !== 404) return last;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg.includes("aborted") || msg.includes("AbortError");
      last = { reachable: false, latencyMs: Date.now() - t0, error: isTimeout ? "timeout" : msg.slice(0, 300), url: path };
    }
  }
  return last;
}

// ── Event push (Casino → Tower) ─────────────────────────────────────────

export type BridgeEventType =
  | "casino.bet"
  | "casino.win"
  | "casino.deposit_pending"
  | "casino.deposit_confirmed"
  | "casino.withdrawal_pending"
  | "casino.withdrawal_settled"
  | "casino.session_start"
  | "casino.session_end"
  | "casino.health"
  | "casino.support_message"
  | "casino.support_ticket"
  | "casino.bonus_released"
  | "bridge.sync_request";

type WebhookCandidate = { path: string; useOrigin?: boolean };

const g = globalThis as unknown as { __tolsBridgeWebhook?: WebhookCandidate | null };

export async function pushBridgeEvent(type: BridgeEventType, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const body = { type, payload, ts: new Date().toISOString(), source: "casino" };
  const configuredWebhook = (await loadActiveGovernanceConnection())?.webhookPath || null;
  const defaults: WebhookCandidate[] = [
    ...(configuredWebhook ? [{ path: configuredWebhook, useOrigin: true }] : []),
    { path: "/api/platform/webhooks", useOrigin: true },
    { path: "/api/platform/webhook", useOrigin: true },
    { path: "/bridge/events" },
    { path: "/api/bridge/events", useOrigin: true },
  ];
  const cached = g.__tolsBridgeWebhook;
  const candidates = cached
    ? [cached, ...defaults.filter((c) => c.path !== cached.path)]
    : defaults;
  for (const c of candidates) {
    try {
      const res = await bridgeFetch({ path: c.path, method: "POST", body, useOrigin: c.useOrigin });
      if (res.status === 404) {
        if (g.__tolsBridgeWebhook?.path === c.path) g.__tolsBridgeWebhook = null;
        continue;
      }
      const text = await res.text();
      let b: unknown = text; try { b = JSON.parse(text); } catch {}
      if (res.ok) g.__tolsBridgeWebhook = c;
      if (res.status === 401 || res.status === 403) return { ok: res.ok, status: res.status, body: b };
      if (res.ok) return { ok: true, status: res.status, body: b };
      return { ok: res.ok, status: res.status, body: b };
    } catch (e) {
      if (c !== candidates[candidates.length - 1]) continue;
      return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
  return { ok: false, status: 404, body: { error: "All webhook candidates returned 404" } };
}

/** Push a settled wager at Governance. Return the promise so `after()` can wait. */
export function pushSettledBet(opts: {
  userId: string;
  game: string;
  amount: number;
  payout: number;
  multiplier: number;
  won: boolean;
  betId: string;
}): Promise<{ ok: boolean; status: number; body?: unknown }> {
  const type: BridgeEventType = opts.won ? "casino.win" : "casino.bet";
  return pushBridgeEvent(type, { ...opts }).catch(() => ({ ok: false, status: 0 }));
}

// ── Inbound event handling (Tower → Casino) ──────────────────────────────

export type InboundBridgeEvent =
  | { type: "governance.rtp_update"; payload: { gameId?: string; userId?: string; mode: string; rtpTarget?: number } }
  | { type: "governance.limits_update"; payload: { userId?: string; limits: Record<string, unknown> } }
  | { type: "governance.feature_flag"; payload: { flag: string; enabled: boolean } }
  | { type: "governance.session_invalidate"; payload: { userId: string } }
  | { type: "governance.wallet_adjust"; payload: { userId: string; amount: number; reason?: string } }
  | { type: "governance.player_block"; payload: { userId: string; blocked: boolean } }
  | { type: "governance.support_reply"; payload: { ticketId: string; userId: string; content: string; agentName?: string } }
  | { type: "governance.support_close"; payload: { ticketId: string; userId: string } }
  | { type: "governance.bonus_credit"; payload: { userId: string; amount: number; multiplier?: number; reason?: string; expiresAt?: string } }
  | { type: "ping"; payload: Record<string, unknown> };

export function isKnownInboundType(t: string): boolean {
  return ["governance.rtp_update","governance.limits_update","governance.feature_flag","governance.session_invalidate","governance.wallet_adjust","governance.player_block","governance.support_reply","governance.support_close","governance.bonus_credit","ping"].includes(t);
}

// ── SSO: cross-domain token (Tower ↔ Casino) — .tols.fun subdomains ─────
// With a cookie on .tols.fun the two projects can share a session; the HMAC token is the fallback when cookies are not enough.

export interface BridgeSsoPayload {
  userId: string;
  email?: string;
  username?: string;
  issuedAt: number;
  nonce: string;
}

export function createBridgeSsoToken(payload: BridgeSsoPayload, secretOverride?: string): string {
  const secret = secretOverride || bridgeSecret();
  if (!secret) throw new Error("GOVERNANCE_BRIDGE_SECRET not configured");
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

export function verifyBridgeSsoToken(token: string | undefined, secretOverride?: string): BridgeSsoPayload | null {
  if (!token) return null;
  const secret = secretOverride || bridgeSecret();
  if (!secret) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expected = createHmac("sha256", secret).update(b64).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString()) as BridgeSsoPayload;
    if (Date.now() - p.issuedAt > 10 * 60 * 1000) return null;
    return p;
  } catch { return null; }
}

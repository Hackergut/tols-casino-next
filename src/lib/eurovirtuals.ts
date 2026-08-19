import { createHash } from "crypto";
import { issueLaunchToken, verifyLaunchToken } from "@/lib/vendor-wallet";

const sha1hex = (s: string) => createHash("sha1").update(s).digest("hex");

/*
 * EuroVirtuals adapter. TOLS is the OPERATOR: we call their /v1/launch to get a
 * game URL, and they call our seamless-wallet callbacks (player_info, bet, win,
 * rollback, adjustment). Requests are signed with EuroVirtuals' custom scheme:
 *
 *   sort the top-level keys; for a primitive append "key=value", for a nested
 *   object append "nestedKey=md5(json(value))" per sorted nested key, for an
 *   array append "index=md5(json(element))"; join with "&"; append the shared
 *   key (App Key for calls we make, Token Key for callbacks we verify); MD5.
 */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

export function evSignature(body: Record<string, unknown>, key: string): string {
  const parts: string[] = [];
  for (const k of Object.keys(body).sort()) {
    const v = body[k];
    if (Array.isArray(v)) {
      v.forEach((el, i) => parts.push(`${i}=${md5(JSON.stringify(el))}`));
    } else if (v !== null && typeof v === "object") {
      const nested = v as Record<string, unknown>;
      for (const nk of Object.keys(nested).sort()) parts.push(`${nk}=${md5(JSON.stringify(nested[nk]))}`);
    } else {
      parts.push(`${k}=${String(v)}`);
    }
  }
  return md5(parts.join("&") + key);
}

/*
 * Token key is derived per-request, not stored: token = MD5(hex(SHA1(appKey +
 * timestamp))). EuroVirtuals signs each callback with this token; we recompute
 * it from our App Key and the request's x-timestamp, then verify the signature.
 */
export function evTokenKey(timestamp: string): string {
  const appKey = process.env.EV_APP_KEY || "";
  return md5(sha1hex(appKey + timestamp));
}

export function verifyEvSignature(body: Record<string, unknown>, provided: string | null, timestamp: string | null): boolean {
  const appKey = process.env.EV_APP_KEY || "";
  if (!appKey || !provided || !timestamp) return false;
  const expected = evSignature(body, evTokenKey(timestamp));
  const got = provided.trim().toLowerCase();
  return expected.length === got.length && expected === got;
}

export function evConfigured(): boolean {
  return Boolean(process.env.EV_APP_KEY);
}

// Player token issued at launch — carries the TOLS user id, verified in callbacks.
export function evPlayerToken(userId: string): string {
  return issueLaunchToken(userId);
}
export function evUserFromToken(token: string | undefined | null): string | null {
  return verifyLaunchToken(token);
}

/** `YYYY-MM-DD H:i:s` UTC, the timestamp format EuroVirtuals expects. */
export function evDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// ── Provider call: request a game launch URL (operator → provider) ──
export interface EvLaunchInput {
  playerId: string; playerName: string; playerToken: string;
  gameUuid: string; currency: string; balance: number;
  demo?: 0 | 1; country?: string; language?: string; device?: "mobile" | "web";
}
export async function evLaunch(input: EvLaunchInput): Promise<{ url: string } | { error: string }> {
  const base = process.env.EV_API_BASE;
  const apiKey = process.env.EV_API_KEY;
  const appKey = process.env.EV_APP_KEY;
  if (!base || !apiKey || !appKey) return { error: "EuroVirtuals not configured" };

  const body: Record<string, unknown> = {
    player_id: input.playerId,
    player_name: input.playerName,
    player_token: input.playerToken,
    game_uuid: input.gameUuid,
    currency: input.currency,
    balance: input.balance,
    demo: input.demo ?? 0,
    ...(input.country ? { country: input.country } : {}),
    ...(input.language ? { language: input.language } : {}),
    ...(input.device ? { device: input.device } : {}),
  };

  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/v1/launch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        "x-signature-key": evSignature(body, appKey),
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j?.status_code === 200 && j?.data?.url) return { url: String(j.data.url) };
    return { error: String(j?.status_description ?? "Launch failed") };
  } catch {
    return { error: "Could not reach EuroVirtuals" };
  }
}

// ── Provider call: fetch the game catalogue (operator → provider) ──
export interface EvGame {
  game_uuid: string;
  game_name: string;
  thumbnail: string;
  category: string;
  provider: string;
  currency: string;
  minimum_stake: Record<string, number>;
  maximum_stake: Record<string, number>;
  maximum_win: Record<string, number>;
  status: number;
}
export async function evGames(): Promise<{ games: EvGame[] } | { error: string }> {
  const base = process.env.EV_API_BASE;
  const apiKey = process.env.EV_API_KEY;
  const appKey = process.env.EV_APP_KEY;
  if (!base || !apiKey || !appKey) return { error: "EuroVirtuals not configured" };

  // Docs show no request body for GET /v1/games; the empty object is what
  // gets signed (verified against staging — signature over {} succeeds).
  const body: Record<string, unknown> = {};
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/v1/games`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
        "x-signature-key": evSignature(body, appKey),
        "x-timestamp": String(Math.floor(Date.now() / 1000)),
      },
    });
    const j = await r.json();
    if (j?.status_code === 200 && Array.isArray(j?.data?.data)) {
      return { games: (j.data.data as EvGame[]).filter((g) => g.status === 1) };
    }
    return { error: String(j?.status_description ?? "Failed to load games") };
  } catch {
    return { error: "Could not reach EuroVirtuals" };
  }
}

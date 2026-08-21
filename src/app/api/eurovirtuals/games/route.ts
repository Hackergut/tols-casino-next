import { NextResponse } from "next/server";
import { evGames, evConfigured } from "@/lib/eurovirtuals";

/*
 * Catalogue of EuroVirtuals games for the lobby. Revalidated every 5 minutes
 * (Next's fetch-level cache would be ideal, but this call signs a fresh
 * timestamp each time, so caching is done here instead) — the catalogue
 * doesn't change minute to minute and this keeps us from hammering their API
 * on every page load.
 */
let cache: { at: number; games: Awaited<ReturnType<typeof evGames>> } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  if (!(await evConfigured())) {
    return NextResponse.json({ success: false, error: "EuroVirtuals not configured" }, { status: 503 });
  }
  if (!cache || Date.now() - cache.at > TTL_MS) {
    cache = { at: Date.now(), games: await evGames() };
  }
  const res = cache.games;
  if ("error" in res) return NextResponse.json({ success: false, error: res.error }, { status: 502 });
  return NextResponse.json({ success: true, data: res.games });
}

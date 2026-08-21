/*
 * Classification of Originals network traffic.
 *
 * The "Connection lost / Your bet was not sent" toast used to fire on every
 * aborted GET to /api/bets/history (the Recent page) and /api/bets/feed.
 * These tests lock the rule: only a real wager POST that fails at the
 * network layer is a lost bet.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("mutations are pathname-exact: history and feed cannot match /api/bets", () => {
  const src = code("src/lib/bet-network.ts");
  assert.match(src, /path === ["']\/api\/bets["']/);
  assert.match(src, /action\|auto-bet/);
  assert.match(src, /method !== ["']POST["']/);
  assert.match(src, /name === ["']AbortError["']/);
  // Query strings must be stripped so /api/bets/history is not /api/bets.
  assert.match(src, /new URL\(url,/);
});

test("GameFeedback no longer toasts on any URL that merely contains /api/bets", () => {
  const src = code("src/components/casino/GameFeedback.tsx");
  assert.match(src, /installBetFetchGuard/);
  assert.doesNotMatch(src, /includes\(["']\/api\/bets["']\)/);
  assert.match(src, /error\.connection/);
  assert.match(src, /error\.betNotSent/);
});

test("the lobby does not refetch games when CMS map identity changes", () => {
  const page = code("src/app/page.tsx");
  assert.doesNotMatch(page, /cmsOverrides\]\)/);
  assert.match(page, /\[activeSection, routeReady\]/);
  assert.doesNotMatch(page, /setInterval\(fetchBets,\s*5000\)/);
  assert.doesNotMatch(page, /fetch\(["']\/api\/bets\?limit=20["']\)/);
});

test("CMS overrides are memoised so the Map is identity-stable", () => {
  const src = code("src/lib/use-cms-cards.ts");
  assert.match(src, /useMemo\(\(\)\s*=>\s*indexCmsOverrides\(rows\),\s*\[rows\]\)/);
});

test("bet history fails closed with 401 instead of throwing for guests", () => {
  const src = code("src/app/api/bets/history/route.ts");
  assert.match(src, /return err\(["']Not authenticated["'],\s*401\)/);
});

test("SSE idle close is debounced and the tab reconnects on focus", () => {
  const src = code("src/hooks/use-realtime.ts");
  assert.match(src, /IDLE_CLOSE_MS/);
  assert.match(src, /idleTimer/);
  assert.match(src, /visibilitychange/);
  assert.match(src, /reopenIfStale/);
});

test("SSE gateways advertise a reconnect delay and a long maxDuration", () => {
  for (const p of ["src/app/api/events/route.ts", "src/app/api/events/public/route.ts"]) {
    const src = code(p);
    assert.match(src, /retry:\s*3000/, `${p} missing EventSource retry`);
    assert.match(src, /maxDuration\s*=\s*300/, `${p} missing maxDuration`);
  }
});

test("aborted history reads are ignored by the Recent page, not toasted", () => {
  const page = code("src/app/page.tsx");
  assert.match(page, /\/api\/bets\/history\?limit=20/);
  assert.match(page, /controller\.signal\.aborted/);
  // CMS is applied at render time so a new Map cannot abort this fetch.
  assert.match(page, /applyCmsToGame\(g, cmsOverrides\.get/);
  assert.match(page, /useMemo\(/);
});

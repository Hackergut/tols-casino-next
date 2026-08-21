/*
 * Realtime bus + public feed.
 *
 * Two kinds of assertion, same convention as bet-sync.test.mjs:
 *
 *  - Behavioural: the REAL src/lib/realtime.ts is transpiled in memory and
 *    exercised — pub/sub routing, channel isolation (user events never reach
 *    public subscribers and vice versa), subscriber fault isolation, and
 *    unsubscribe semantics.
 *  - Source-reading (comments stripped first): the wiring that needs a
 *    database or a browser to execute — settlement broadcasting, SSE route
 *    behaviour, client subscription sharing — is asserted against the code.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Strip comments so greps can't match prose describing removed behaviour. */
const code = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------------ *
 * Load the REAL bus, not a reimplementation.
 * ------------------------------------------------------------------ */

function loadRealtime() {
  const source = read("src/lib/realtime.ts");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  // Fresh global bus per load: the module parks its state on globalThis to
  // survive hot reload, so tests must clear it to stay independent.
  delete globalThis.__tolsRealtimeBus;
  new Function("module", "exports", "require", "process", js)(mod, mod.exports, () => ({}), {
    env: {}, // no REDIS_URL → pure in-process routing
  });
  return mod.exports;
}

test("user events reach user subscribers and only them", () => {
  const rt = loadRealtime();
  const seenUser = [];
  const seenPublic = [];
  rt.subscribe((e) => seenUser.push(e));
  rt.subscribePublic((e) => seenPublic.push(e));

  rt.publish({ event: "balance:update", userId: "u1", data: { balance: 42 } });

  assert.equal(seenUser.length, 1);
  assert.equal(seenUser[0].data.balance, 42);
  assert.equal(seenPublic.length, 0, "a private event must never hit the public channel");
});

test("public events reach public subscribers and only them", () => {
  const rt = loadRealtime();
  const seenUser = [];
  const seenPublic = [];
  rt.subscribe((e) => seenUser.push(e));
  rt.subscribePublic((e) => seenPublic.push(e));

  rt.publishPublic({ event: "jackpot:update", data: { amount: 50001 } });

  assert.equal(seenPublic.length, 1);
  assert.equal(seenPublic[0].data.amount, 50001);
  assert.equal(seenUser.length, 0, "a public event must never hit the private channel");
});

test("unsubscribe stops delivery without touching other subscribers", () => {
  const rt = loadRealtime();
  const a = [];
  const b = [];
  const offA = rt.subscribePublic((e) => a.push(e));
  rt.subscribePublic((e) => b.push(e));

  rt.publishPublic({ event: "chat:message", data: { id: "m1" } });
  offA();
  rt.publishPublic({ event: "chat:message", data: { id: "m2" } });

  assert.equal(a.length, 1);
  assert.equal(b.length, 2);
});

test("a throwing subscriber cannot break delivery to the others", () => {
  const rt = loadRealtime();
  const seen = [];
  rt.subscribePublic(() => {
    throw new Error("boom");
  });
  rt.subscribePublic((e) => seen.push(e));

  rt.publishPublic({ event: "feed:bet", data: { id: "b1" } });

  assert.equal(seen.length, 1);
});

test("the bus state survives module re-evaluation (hot reload)", () => {
  const rt1 = loadRealtime();
  const seen = [];
  rt1.subscribePublic((e) => seen.push(e));

  // Re-evaluate WITHOUT clearing the global (what a dev hot reload does).
  const source = read("src/lib/realtime.ts");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", "process", js)(mod, mod.exports, () => ({}), { env: {} });
  const rt2 = mod.exports;

  rt2.publishPublic({ event: "feed:bet", data: { id: "b1" } });
  assert.equal(seen.length, 1, "subscribers registered before a reload must keep receiving events");
});

/* ------------------------------------------------------------------ *
 * Server wiring — asserted against the source, comments stripped.
 * ------------------------------------------------------------------ */

test("every settlement path broadcasts to the public feed", () => {
  const settle = code("src/lib/settle-bet.ts");
  // Instant bets broadcast after settling, outside the money path.
  assert.match(settle, /broadcastSettledBet\(/);
  assert.match(settle, /after\(\(\)\s*=>\s*\n?\s*broadcastSettledBet/);

  const rounds = code("src/lib/game-rounds.ts");
  // Interactive rounds converge on finalizeHouse, which carries the broadcast
  // — so settle, player-action and expiry paths are all covered by one hook.
  assert.match(rounds, /function finalizeHouse/);
  assert.match(rounds, /broadcastSettledBet\(/);
});

test("the public payload builder exposes only username and avatarColor", () => {
  const feed = code("src/lib/public-feed.ts");
  assert.match(feed, /select:\s*\{\s*username:\s*true,\s*avatarColor:\s*true\s*\}/);
  assert.doesNotMatch(feed, /email/i, "an email field in the public builder is a leak");
  assert.doesNotMatch(feed, /balance/i, "a balance field in the public builder is a leak");
});

test("chat messages are broadcast on send", () => {
  const chat = code("src/app/api/casino-chat/route.ts");
  assert.match(chat, /publishPublic\(\{\s*event:\s*"chat:message"/);
});

test("the jackpot broadcast reads the post-increment value, not a guess", () => {
  const settle = code("src/lib/settle-bet.ts");
  const rounds = code("src/lib/game-rounds.ts");
  for (const src of [settle, rounds]) {
    assert.match(src, /\.then\(\(jp\)\s*=>\s*broadcastJackpot\(jp\.amount/);
  }
});

test("both SSE gateways handle disconnects idempotently", () => {
  for (const p of ["src/app/api/events/route.ts", "src/app/api/events/public/route.ts"]) {
    const src = code(p);
    assert.match(src, /if \(closed\) return;/, `${p}: close() must be idempotent`);
    assert.match(src, /cancel\(\)/, `${p}: stream cancel must release the subscription`);
    assert.match(src, /X-Accel-Buffering/, `${p}: proxies must not buffer the stream`);
  }
});

test("the private gateway still filters by userId", () => {
  const src = code("src/app/api/events/route.ts");
  assert.match(src, /e\.userId !== userId\) return/);
});

/* ------------------------------------------------------------------ *
 * Client wiring.
 * ------------------------------------------------------------------ */

test("the client keeps one shared EventSource per stream", () => {
  const src = code("src/hooks/use-realtime.ts");
  // Managers live on globalThis (Fast Refresh) and there are exactly two.
  assert.match(src, /__tolsSSE/);
  assert.match(src, /\/api\/events\/public/);
  // Reconnect with capped exponential backoff after terminal failures.
  assert.match(src, /EventSource\.CLOSED/);
  assert.match(src, /Math\.min\(30_000/);
  // Idle streams are closed — no subscriber, no socket.
  assert.match(src, /closeIfIdle/);
});

test("components consume the shared stream, not their own EventSource", () => {
  const support = code("src/components/lobby/SupportChat.tsx");
  assert.doesNotMatch(support, /new EventSource/, "SupportChat must use the shared manager");
  assert.match(support, /useUserEvent/);

  const chat = code("src/components/lobby/CommunityPanels.tsx");
  assert.doesNotMatch(chat, /setInterval\(load, 5000\)/, "chat must not poll every 5s anymore");
  assert.match(chat, /usePublicEvent/);
});

test("live balance events enter the store through the authoritative writer", () => {
  const page = code("src/app/page.tsx");
  assert.match(page, /useUserEvent/);
  assert.match(page, /applyServer\(d\.balance\)/, "SSE balance is transaction-derived: applyServer, never applyPoll");
});

test("the winners endpoint serves real settled wins, not demo data", () => {
  const src = code("src/app/api/winners/route.ts");
  assert.match(src, /casinoBet\.findMany/);
  assert.doesNotMatch(src, /CryptoKing99/, "hardcoded demo winners must be gone");
});

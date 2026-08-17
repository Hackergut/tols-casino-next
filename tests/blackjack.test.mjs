import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import crypto from "node:crypto";

const source = readFileSync(new URL("../src/lib/blackjack.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, (id) => id === "crypto" ? crypto : null);
const bj = mod.exports;
const serverSource = readFileSync(new URL("../src/lib/blackjack-server.ts", import.meta.url), "utf8");
const serverJs = ts.transpileModule(serverSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const server = { exports: {} };
new Function("module", "exports", "require", serverJs)(server, server.exports, (id) => id === "crypto" ? crypto : id === "@/lib/blackjack" ? bj : null);

const c = (rank, suit = "spades") => ({ rank, suit });

test("blackjack shoe contains six decks and burns one card", () => {
  const a = server.exports.shuffledShoe("server", "client", 7);
  const b = server.exports.shuffledShoe("server", "client", 7);
  assert.equal(a.length, 311);
  assert.deepEqual(a, b, "committed seed tuple must reproduce the shoe");
});

test("aces score as 11 until the hand would bust", () => {
  assert.deepEqual(bj.handValue([c("A"), c("K")]), { total: 21, soft: true });
  assert.equal(bj.handValue([c("A"), c("9"), c("8")]).total, 18);
  assert.equal(bj.handValue([c("A"), c("A"), c("9")]).total, 21);
});

test("dealer stands on hard and soft 17", () => {
  assert.equal(bj.dealerShouldHit([c("10"), c("6")]), true);
  assert.equal(bj.dealerShouldHit([c("10"), c("7")]), false);
  assert.equal(bj.dealerShouldHit([c("A"), c("6")]), false);
});

test("natural blackjack pays 3 to 2 plus stake return", () => {
  const state = { version: 1, deck: [], dealer: [c("10"), c("7")], hands: [{ cards: [c("A"), c("K")], bet: 10, status: "active" }], activeHand: 0, originalBet: 10, insurance: 0, insuranceResolved: true, splitUsed: false, phase: "player", serverSeedHash: "x", clientSeed: "y", nonce: 1, createdAt: "now" };
  assert.equal(bj.settle(state).payout, 25);
});

test("insurance is offered only against an ace and pays 2 to 1", () => {
  const state = { version: 1, deck: [], dealer: [c("K"), c("A")], hands: [{ cards: [c("10"), c("9")], bet: 10, status: "active" }], activeHand: 0, originalBet: 10, insurance: 5, insuranceResolved: true, splitUsed: false, phase: "player", serverSeedHash: "x", clientSeed: "y", nonce: 1, createdAt: "now" };
  assert.equal(bj.settle(state).payout, 15);
});

test("money-changing blackjack actions use optimistic DB state claims", () => {
  const route = readFileSync(new URL("../src/app/api/blackjack/action/route.ts", import.meta.url), "utf8");
  assert.match(route, /result: "active", payload: bet\.payload/);
  assert.match(route, /balance: \{ gte: extraDebit \}/);
  assert.match(route, /claimed\.count !== 1/);
});

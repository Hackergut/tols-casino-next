/*
 * Auto-bet contract tests (autoplay-system-designer skill).
 *
 * The pure math (src/lib/auto-bet-math.ts) is import-free, so the exact code
 * the server runs is tested here: parameter clamping, stake adjustment and
 * the deterministic stop-condition rules.
 *
 *   node --test tests/auto-bet.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../src/lib/auto-bet-math.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const A = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

const { nextStake, normalizeAutoBetParams } = A;

test("normalize: rounds clamped to [1, 1000] — auto-play is never unbounded", () => {
  assert.equal(normalizeAutoBetParams({ baseBet: 1, rounds: 0 }).rounds, 1);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, rounds: -5 }).rounds, 1);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, rounds: 5000 }).rounds, 1000);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, rounds: 25 }).rounds, 25);
  assert.equal(normalizeAutoBetParams({ baseBet: 1 }).rounds, 10); // default
});

test("normalize: base bet never below the minimum stake", () => {
  assert.equal(normalizeAutoBetParams({ baseBet: 0 }).baseBet, 0.01);
  assert.equal(normalizeAutoBetParams({ baseBet: -3 }).baseBet, 0.01);
  assert.equal(normalizeAutoBetParams({ baseBet: 5 }).baseBet, 5);
});

test("normalize: stop-loss / take-profit are non-negative (disabled by default)", () => {
  assert.equal(normalizeAutoBetParams({ baseBet: 1, stopLoss: -10 }).stopLoss, 0);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, takeProfit: -10 }).takeProfit, 0);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, stopLoss: 25, takeProfit: 40 }).stopLoss, 25);
  assert.equal(normalizeAutoBetParams({ baseBet: 1, stopLoss: 25, takeProfit: 40 }).takeProfit, 40);
});

test("nextStake: reset returns to base", () => {
  assert.equal(nextStake(12.5, 1, "reset", 100), 1);
  assert.equal(nextStake(1, 2.5, "reset", 0), 2.5);
});

test("nextStake: fixed keeps the stake", () => {
  assert.equal(nextStake(7.25, 1, "fixed", 100), 7.25);
});

test("nextStake: increase by percentage, rounded to cents", () => {
  assert.equal(nextStake(10, 10, "increase", 100), 20);
  assert.equal(nextStake(10, 10, "increase", 50), 15);
  assert.equal(nextStake(0.01, 0.01, "increase", 100), 0.02);
});

test("nextStake: decrease by percentage, floored at the minimum", () => {
  assert.equal(nextStake(10, 10, "decrease", 50), 5);
  assert.equal(nextStake(0.02, 10, "decrease", 50), 0.01); // floor
  assert.equal(nextStake(0.01, 10, "decrease", 100), 0.01); // never below min
});

test("nextStake: percent cannot go negative", () => {
  assert.equal(nextStake(10, 10, "increase", -50), 10);
  assert.equal(nextStake(10, 10, "decrease", -50), 10);
});

test("round-trip: a full 3-round martingale reset sequence stays sane", () => {
  let stake = 1;
  stake = nextStake(stake, 1, "increase", 100); // loss → double
  assert.equal(stake, 2);
  stake = nextStake(stake, 1, "increase", 100);
  assert.equal(stake, 4);
  stake = nextStake(stake, 1, "reset", 100); // win → back to base
  assert.equal(stake, 1);
});
